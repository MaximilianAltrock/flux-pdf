import type { Ref } from 'vue'
import JSZip from 'jszip'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { DEFAULT_PROJECT_TITLE, EXPORT_PROGRESS, PROGRESS } from '@/shared/constants'
import type { Command } from '@/domains/history/domain/commands/types'
import { executeCommandBatch, type HistoryBatchCommandExecutor } from '@/domains/history/application'
import {
  AddPagesCommand,
  AddSourceCommand,
} from '@/domains/history/domain/commands'
import type { DocumentMetadata, FileUploadResult, PageEntry, PageReference } from '@/shared/types'
import type { Result } from '@/shared/types/result'
import {
  usePdfCompression,
  type CompressionOptions,
  type CompressionResult,
} from '@/domains/export/application/usePdfCompression'
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
import { buildOutlineForImport } from '@/domains/document/domain/outline'
import {
  getExportErrorMessage,
  getImportErrorMessage,
  isDocumentError,
  makeDocumentError,
} from '@/domains/document/domain/errors'
import type { DocumentError, ExportErrorCode } from '@/domains/document/domain/errors'
import { loadPdfFiles } from '@/domains/document/infrastructure/import'
import type { JobState } from '@/domains/editor/store/ui.store'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import { formatFilenamePattern, stripPdfExtension } from '@/shared/utils/filename-pattern'

export interface PdfRepository {
  getPdfDocument: (sourceFileId: string) => Promise<PDFDocumentProxy>
  getPdfBlob: (sourceFileId: string) => Promise<ArrayBuffer | undefined>
}

export interface DocumentUiBindings {
  setLoading?: (loading: boolean, message?: string) => void
  importJob?: Ref<JobState>
  exportJob?: Ref<JobState>
}

export interface DocumentServiceSettings {
  autoGenerateOutlineSinglePage: Ref<boolean>
  filenamePattern: Ref<string>
}

export interface DocumentServiceDeps {
  documentStore: ReturnType<typeof useDocumentStore>
  historyStore: HistoryBatchCommandExecutor
  pdfRepository: PdfRepository
  ui?: DocumentUiBindings
  compression?: {
    compressPdf: (data: Uint8Array, options?: CompressionOptions) => Promise<CompressionResult>
  }
  settings: DocumentServiceSettings
}

export interface ImportSummary {
  results: FileUploadResult[]
  successes: FileUploadResult[]
  errors: FileUploadResult[]
  totalPages: number
}

export interface ImportOptions {
  addPages?: boolean
}

function getExportErrorCode(error: unknown): ExportErrorCode {
  if (error instanceof Error) {
    if (error.message.startsWith('Source file not found:')) {
      return 'EXPORT_SOURCE_MISSING'
    }
  }
  return 'EXPORT_FAILED'
}

export function createDocumentService(deps: DocumentServiceDeps) {
  const store = deps.documentStore
  const history = deps.historyStore
  const ui = deps.ui
  const settings = deps.settings
  const { getPdfDocument, getPdfBlob } = deps.pdfRepository
  const compression = deps.compression ?? usePdfCompression()

  const setLoading = (loading: boolean, message?: string) => {
    ui?.setLoading?.(loading, message)
  }

  const setImportJob = (job: JobState) => {
    if (ui?.importJob) ui.importJob.value = job
  }

  const setExportJob = (job: JobState) => {
    if (ui?.exportJob) ui.exportJob.value = job
  }

  const updateExportProgress = (progress: number) => {
    if (ui?.exportJob) ui.exportJob.value.progress = progress
  }

  function buildMetadataUpdates(metadata: DocumentMetadata): Partial<DocumentMetadata> {
    const updates: Partial<DocumentMetadata> = {}
    if (metadata.title.trim()) updates.title = metadata.title
    if (metadata.author.trim()) updates.author = metadata.author
    if (metadata.subject.trim()) updates.subject = metadata.subject
    if (metadata.keywords.length > 0) updates.keywords = metadata.keywords
    if (metadata.pdfVersion) updates.pdfVersion = metadata.pdfVersion
    return updates
  }

  function isDefaultMetadata(value: DocumentMetadata): boolean {
    return (
      value.title.trim() === DEFAULT_PROJECT_TITLE &&
      !value.author.trim() &&
      !value.subject.trim() &&
      value.keywords.length === 0
    )
  }

  function maybeApplyMetadataFromSource(metadata: DocumentMetadata | null): void {
    if (!metadata) return
    if (store.metadataDirty) return
    if (!isDefaultMetadata(store.metadata)) return
    const updates = buildMetadataUpdates(metadata)
    if (Object.keys(updates).length === 0) return
    store.setMetadata(updates)
  }

  async function importFiles(
    files: FileList | File[],
    options: ImportOptions = {},
  ): Promise<Result<ImportSummary>> {
    const fileList = Array.from(files)
    if (fileList.length === 0) {
      return { ok: true, value: { results: [], successes: [], errors: [], totalPages: 0 } }
    }

    setImportJob({ status: 'running', progress: PROGRESS.MIN, error: null })
    const loadingLabel =
      fileList.length === 1
        ? `Processing ${fileList[0]?.name ?? 'file'}...`
        : `Processing ${fileList.length} files...`
    setLoading(true, loadingLabel)

    try {
      const results = await loadPdfFiles(fileList, {
        initialColorIndex: store.sources.size,
      })
      for (const result of results) {
        if (result.success && result.sourceFile?.metadata) {
          maybeApplyMetadataFromSource(result.sourceFile.metadata)
        }
      }

      const successes = results.filter((r) => r.success)
      const errors = results.filter((r) => !r.success)

      if (successes.length > 0) {
        const commandsToRun: Command[] = []
        const addPages = options.addPages !== false

        for (const result of successes) {
          if (!result.sourceFile) continue
          if (addPages && result.pageRefs) {
            commandsToRun.push(new AddPagesCommand(result.sourceFile, result.pageRefs, true))
          } else if (!addPages) {
            commandsToRun.push(new AddSourceCommand(result.sourceFile))
          }
        }

        if (commandsToRun.length > 0) {
          const batchName = addPages
            ? `Import ${commandsToRun.length} files`
            : `Register ${commandsToRun.length} sources`
          executeCommandBatch(history, commandsToRun, batchName)
        }

        if (addPages) {
          const autoGenerateSinglePage = settings.autoGenerateOutlineSinglePage.value
          const outlineAdditions = successes.flatMap((result) => {
            if (!result.sourceFile || !result.pageRefs?.length) return []
            return buildOutlineForImport({
              filename: result.sourceFile.filename,
              outline: result.sourceFile.outline ?? [],
              pageRefs: result.pageRefs,
              autoGenerateSinglePage,
            })
          })

          if (outlineAdditions.length > 0) {
            store.setOutlineTree([...store.outlineTree, ...outlineAdditions], false)
          }
        }
      }

      const totalPages = successes.reduce((sum, r) => sum + (r.sourceFile?.pageCount ?? 0), 0)

      setImportJob({ status: 'success', progress: PROGRESS.COMPLETE, error: null })
      return { ok: true, value: { results, successes, errors, totalPages } }
    } catch (error) {
      const message = getImportErrorMessage(
        'IMPORT_FAILED',
        error instanceof Error ? error.message : undefined,
      )
      const importError = makeDocumentError('IMPORT_FAILED', message, error)
      setImportJob({
        status: 'error',
        progress: PROGRESS.MIN,
        error: importError.message,
        errorCode: importError.code,
      })
      return { ok: false, error: importError }
    } finally {
      setLoading(false)
    }
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
      const error = makeDocumentError('EXPORT_NO_PAGES')
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
          throw makeDocumentError(
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
      let documentError: DocumentError

      if (isDocumentError(error)) {
        documentError = error
      } else {
        const code = getExportErrorCode(error)
        const message =
          code === 'EXPORT_SOURCE_MISSING' && error instanceof Error
            ? error.message
            : getExportErrorMessage(code, error instanceof Error ? error.message : undefined)
        documentError = makeDocumentError(code, message, error)
      }

      setExportJob({
        status: 'error',
        progress: PROGRESS.MIN,
        error: documentError.message,
        errorCode: documentError.code,
      })
      return { ok: false, error: documentError }
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

  return {
    importFiles,
    exportDocument,
    generateRawPdf,
    clearExportError,
    getSuggestedFilename,
    getEstimatedSize,
    parsePageRange,
    validatePageRange,
    getPdfDocument,
    getPdfBlob,
    importJob: ui?.importJob,
    exportJob: ui?.exportJob,
  }
}

export type DocumentService = ReturnType<typeof createDocumentService>
export type { ExportOptions, ExportResult, GeneratorOptions }


