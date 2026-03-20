import JSZip from 'jszip'
import { EXPORT_PROGRESS, PROGRESS } from '@/shared/constants'
import type { PageEntry, PageReference } from '@/shared/types'
import type { Result } from '@/shared/types/result'
import type { JobState } from '@/shared/types/jobs'
import { usePdfCompression } from '@/domains/export/application/usePdfCompression'
import {
  generateRawPdf as generateRawPdfCore,
  parsePageRange,
  resolvePagesToExport,
  splitPagesIntoSegments,
  validatePageRange,
  type ExportOptions,
  type ExportResult,
  type GeneratorOptions,
} from '@/domains/export/domain/export'
import {
  getExportErrorMessage,
  isExportError,
  makeExportError,
} from '@/domains/export/domain/errors'
import type { ExportError, ExportErrorCode } from '@/domains/export/domain/errors'
import { formatFilenamePattern, stripPdfExtension } from '@/shared/utils/filename-pattern'
import type { ExportServiceDeps } from '@/domains/export/application/export-service'

function getExportErrorCode(error: unknown): ExportErrorCode {
  if (error instanceof Error) {
    if (error.message.startsWith('Source file not found:')) {
      return 'EXPORT_SOURCE_MISSING'
    }
  }
  return 'EXPORT_FAILED'
}

export function createDocumentExportService(deps: ExportServiceDeps) {
  const store = deps.documentStore
  const ui = deps.ui
  const settings = deps.settings
  const { getPdfDocument, getPdfBlob } = deps.pdfRepository
  const ownsCompression = !deps.compression
  const compression = deps.compression ?? usePdfCompression()

  const setExportJob = (job: JobState) => {
    if (ui?.exportJob) ui.exportJob.value = job
  }

  const updateExportProgress = (progress: number) => {
    if (ui?.exportJob) ui.exportJob.value.progress = progress
  }

  function clearExportError(): void {
    setExportJob({
      status: 'idle',
      progress: PROGRESS.MIN,
      error: null,
      errorCode: null,
    })
  }

  async function generateRawPdf(
    pages: PageReference[],
    options: GeneratorOptions & { outline?: ExportOptions['outline'] } = {},
  ): Promise<Result<Uint8Array>> {
    try {
      const pageIdToDocIndex = new Map(store.contentPages.map((page, index) => [page.id, index]))
      const pdfBytes = await generateRawPdfCore(pages, {
        ...options,
        getPdfBlob,
        getPdfDocument,
        bookmarks: store.outlineTree,
        pageIdToDocIndex,
        outline: options.outline,
      })
      return { ok: true, value: pdfBytes }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      return { ok: false, error: { message, cause: error } }
    }
  }

  async function exportDocument(options: ExportOptions): Promise<Result<ExportResult>> {
    const { filename, pageRange, metadata, compress, outline } = options
    const pageIdToDocIndex = new Map(store.contentPages.map((page, index) => [page.id, index]))

    const pagesToExport: PageEntry[] = resolvePagesToExport({
      pageRange,
      pages: store.pages,
      contentPages: store.contentPages,
      contentPageCount: store.contentPageCount,
    })

    const segments = splitPagesIntoSegments(pagesToExport)

    if (segments.length === 0) {
      const error = makeExportError('EXPORT_NO_PAGES')
      setExportJob({
        status: 'error',
        progress: PROGRESS.MIN,
        error: error.message,
        errorCode: error.code,
      })
      return { ok: false, error }
    }

    setExportJob({ status: 'running', progress: PROGRESS.MIN, error: null })

    try {
      if (segments.length > 1) {
        const zip = new JSZip()

        for (let i = 0; i < segments.length; i++) {
          const segmentPages = segments[i]
          if (!segmentPages || segmentPages.length === 0) continue

          const pdfBytes = await generateRawPdfCore(segmentPages, {
            metadata,
            compress,
            onProgress: undefined,
            getPdfBlob,
            getPdfDocument,
            bookmarks: store.outlineTree,
            pageIdToDocIndex,
            outline,
          })

          zip.file(`${filename}-part${i + 1}.pdf`, pdfBytes)
          updateExportProgress(Math.round(((i + 1) / segments.length) * EXPORT_PROGRESS.ZIP_MAX))
        }

        updateExportProgress(EXPORT_PROGRESS.ZIP_FINALIZE)
        const zipContent = await zip.generateAsync({ type: 'uint8array' })
        updateExportProgress(PROGRESS.COMPLETE)

        const zipFilename = `${filename}.zip`
        setExportJob({ status: 'success', progress: PROGRESS.COMPLETE, error: null })
        return {
          ok: true,
          value: {
            filename: zipFilename,
            mimeType: 'application/zip',
            bytes: zipContent,
            size: zipContent.byteLength,
          },
        }
      }

      const segmentPages = segments[0]
      if (!segmentPages) {
        throw new Error('No pages generated')
      }

      let pdfBytes = await generateRawPdfCore(segmentPages, {
        metadata,
        compress,
        onProgress: (val) => {
          const scaledProgress =
            options.compressionQuality && options.compressionQuality !== 'none'
              ? Math.round(val * EXPORT_PROGRESS.COMPRESSION_SCALE)
              : val
          updateExportProgress(scaledProgress)
        },
        getPdfBlob,
        getPdfDocument,
        bookmarks: store.outlineTree,
        pageIdToDocIndex,
        outline,
      })

      let originalSize = pdfBytes.byteLength
      let compressionRatio = 0

      const pagesBySource = new Map<string, number>()
      for (const p of segmentPages) {
        if (p.isDivider) continue
        const count = pagesBySource.get(p.sourceFileId) || 0
        pagesBySource.set(p.sourceFileId, count + 1)
      }

      let isFullSourceExport = true
      for (const [sId, count] of pagesBySource) {
        const source = store.sources.get(sId)
        if (source && count !== source.pageCount) {
          isFullSourceExport = false
          break
        }
      }

      if (isFullSourceExport && segmentPages.length > 0) {
        originalSize = getEstimatedSize(segmentPages)
      }

      if (options.compressionQuality && options.compressionQuality !== 'none') {
        updateExportProgress(EXPORT_PROGRESS.COMPRESSION_START)
        let result
        try {
          result = await compression.compressPdf(pdfBytes, {
            quality: options.compressionQuality,
          })
        } catch (error) {
          throw makeExportError(
            'EXPORT_COMPRESSION_FAILED',
            getExportErrorMessage(
              'EXPORT_COMPRESSION_FAILED',
              error instanceof Error ? error.message : undefined,
            ),
            error,
          )
        }
        pdfBytes = result.data

        if (!isFullSourceExport) {
          originalSize = result.originalSize
        }

        if (originalSize > 0) {
          compressionRatio = 1 - pdfBytes.byteLength / originalSize
        }
        updateExportProgress(EXPORT_PROGRESS.COMPRESSION_END)
      }

      updateExportProgress(PROGRESS.COMPLETE)

      const pdfFilename = `${filename}.pdf`
      setExportJob({ status: 'success', progress: PROGRESS.COMPLETE, error: null })
      return {
        ok: true,
        value: {
          filename: pdfFilename,
          mimeType: 'application/pdf',
          bytes: pdfBytes,
          size: pdfBytes.byteLength,
          originalSize: originalSize !== pdfBytes.byteLength ? originalSize : undefined,
          compressionRatio: compressionRatio > 0 ? compressionRatio : undefined,
        },
      }
    } catch (error) {
      let exportError: ExportError

      if (isExportError(error)) {
        exportError = error
      } else {
        const code = getExportErrorCode(error)
        const message =
          code === 'EXPORT_SOURCE_MISSING' && error instanceof Error
            ? error.message
            : getExportErrorMessage(code, error instanceof Error ? error.message : undefined)
        exportError = makeExportError(code, message, error)
      }

      setExportJob({
        status: 'error',
        progress: PROGRESS.MIN,
        error: exportError.message,
        errorCode: exportError.code,
      })
      return { ok: false, error: exportError }
    }
  }

  function getSuggestedFilename(): string {
    const sources = store.sourceFileList
    const defaultName =
      sources.length === 0
        ? 'document'
        : sources.length === 1 && sources[0]
          ? stripPdfExtension(sources[0].filename)
          : 'merged-document'

    return formatFilenamePattern(settings.filenamePattern.value, {
      originalName: defaultName,
      name: defaultName,
      version: 1,
    })
  }

  function getEstimatedSize(pagesToEstimate?: ReadonlyArray<PageReference>): number {
    const pagesList = pagesToEstimate || store.contentPages
    let totalEstimatedSize = 0

    const pagesBySource = new Map<string, number>()

    for (const page of pagesList) {
      if (page.isDivider) continue
      const currentCount = pagesBySource.get(page.sourceFileId) || 0
      pagesBySource.set(page.sourceFileId, currentCount + 1)
    }

    for (const [sourceId, count] of pagesBySource) {
      const source = store.sources.get(sourceId)
      if (!source) continue

      if (count === source.pageCount) {
        totalEstimatedSize += source.fileSize
      } else {
        const avgPageSize = source.fileSize / Math.max(1, source.pageCount)
        totalEstimatedSize += count * avgPageSize
      }
    }

    return totalEstimatedSize
  }

  function dispose(): void {
    if (ownsCompression) {
      compression.dispose?.()
    }
  }

  return {
    exportDocument,
    generateRawPdf,
    clearExportError,
    getSuggestedFilename,
    getEstimatedSize,
    parsePageRange,
    validatePageRange,
    getPdfDocument,
    getPdfBlob,
    exportJob: ui?.exportJob,
    dispose,
  }
}

export type DocumentExportService = ReturnType<typeof createDocumentExportService>
