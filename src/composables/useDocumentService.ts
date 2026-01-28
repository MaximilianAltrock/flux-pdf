import { ref, type Ref } from 'vue'
import JSZip from 'jszip'
import { EXPORT_PROGRESS, PROGRESS } from '@/constants'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { AddPagesCommand, AddSourceCommand, BatchCommand } from '@/commands'
import type { Command } from '@/commands/types'
import type { DocumentMetadata, FileUploadResult, PageEntry, PageReference } from '@/types'
import type { Result } from '@/types/result'
import { usePdfCompression } from '@/composables/usePdfCompression'
import {
  generateRawPdf as generateRawPdfCore,
  parsePageRange,
  resolvePagesToExport,
  splitPagesIntoSegments,
  validatePageRange,
  type ExportOptions,
  type ExportResult,
  type GeneratorOptions,
} from '@/domain/document/export'
import {
  getExportErrorMessage,
  getImportErrorMessage,
  isDocumentError,
  makeDocumentError,
} from '@/domain/document/errors'
import type { DocumentError, ExportErrorCode } from '@/domain/document/errors'
import type { DocumentErrorCode } from '@/types/errors'
import { getPdfBlob, getPdfDocument, loadPdfFiles } from '@/domain/document/import'

type JobStatus = 'idle' | 'running' | 'success' | 'error'

export interface JobState {
  status: JobStatus
  progress: number
  error: string | null
  errorCode?: DocumentErrorCode | null
}

function createJobState(): JobState {
  return {
    status: 'idle',
    progress: PROGRESS.MIN,
    error: null,
    errorCode: null,
  }
}

function getExportErrorCode(error: unknown): ExportErrorCode {
  if (error instanceof Error) {
    if (error.message.startsWith('Source file not found:')) {
      return 'EXPORT_SOURCE_MISSING'
    }
  }
  return 'EXPORT_FAILED'
}

const importJob = ref<JobState>(createJobState())
const exportJob = ref<JobState>(createJobState())

export type DocumentUiState = {
  zoom: Ref<number>
  setZoom: (level: number) => void
  setLoading: (loading: boolean, message?: string) => void
}

let boundUiState: DocumentUiState | null = null

export interface ImportSummary {
  results: FileUploadResult[]
  successes: FileUploadResult[]
  errors: FileUploadResult[]
  totalPages: number
}

export interface ImportOptions {
  addPages?: boolean
}

export function useDocumentService(uiState?: DocumentUiState) {
  if (uiState) {
    boundUiState = uiState
  }

  const ui = boundUiState
  const { compressPdf } = usePdfCompression()

  const store = useDocumentStore()
  const { execute } = useCommandManager()

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
      value.title.trim() === 'Untitled Project' &&
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

    importJob.value = { status: 'running', progress: PROGRESS.MIN, error: null }
    const loadingLabel =
      fileList.length === 1
        ? `Processing ${fileList[0]?.name ?? 'file'}...`
        : `Processing ${fileList.length} files...`
    ui?.setLoading(true, loadingLabel)

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

        if (commandsToRun.length === 1) {
          execute(commandsToRun[0]!)
        } else if (commandsToRun.length > 1) {
          const batchName = addPages
            ? `Import ${commandsToRun.length} files`
            : `Register ${commandsToRun.length} sources`
          const batchCmd = new BatchCommand(commandsToRun, batchName)
          execute(batchCmd)
        }
      }

      const totalPages = successes.reduce((sum, r) => sum + (r.sourceFile?.pageCount ?? 0), 0)

      importJob.value = { status: 'success', progress: PROGRESS.COMPLETE, error: null }
      return { ok: true, value: { results, successes, errors, totalPages } }
    } catch (error) {
      const message = getImportErrorMessage(
        'IMPORT_FAILED',
        error instanceof Error ? error.message : undefined,
      )
      const importError = makeDocumentError('IMPORT_FAILED', message, error)
      importJob.value = {
        status: 'error',
        progress: PROGRESS.MIN,
        error: importError.message,
        errorCode: importError.code,
      }
      return { ok: false, error: importError }
    } finally {
      ui?.setLoading(false)
    }
  }

  function clearExportError(): void {
    exportJob.value = {
      status: 'idle',
      progress: PROGRESS.MIN,
      error: null,
      errorCode: null,
    }
  }

  async function generateRawPdf(
    pages: PageReference[],
    options: GeneratorOptions = {},
  ): Promise<Result<Uint8Array>> {
    try {
      const pdfBytes = await generateRawPdfCore(pages, {
        ...options,
        getPdfBlob,
        bookmarks: store.bookmarksTree,
      })
      return { ok: true, value: pdfBytes }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      return { ok: false, error: { message, cause: error } }
    }
  }

  async function exportDocument(options: ExportOptions): Promise<Result<ExportResult>> {
    const { filename, pageRange, metadata, compress } = options

    const pagesToExport: PageEntry[] = resolvePagesToExport({
      pageRange,
      pages: store.pages,
      contentPages: store.contentPages,
      contentPageCount: store.contentPageCount,
    })

    const segments = splitPagesIntoSegments(pagesToExport)

    if (segments.length === 0) {
      const error = makeDocumentError('EXPORT_NO_PAGES')
      exportJob.value = {
        status: 'error',
        progress: PROGRESS.MIN,
        error: error.message,
        errorCode: error.code,
      }
      return { ok: false, error }
    }

    exportJob.value = { status: 'running', progress: PROGRESS.MIN, error: null }

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
            bookmarks: store.bookmarksTree,
          })

          zip.file(`${filename}-part${i + 1}.pdf`, pdfBytes)
          exportJob.value.progress = Math.round(
            ((i + 1) / segments.length) * EXPORT_PROGRESS.ZIP_MAX,
          )
        }

        exportJob.value.progress = EXPORT_PROGRESS.ZIP_FINALIZE
        const zipContent = await zip.generateAsync({ type: 'uint8array' })
        exportJob.value.progress = PROGRESS.COMPLETE

        const zipFilename = `${filename}.zip`
        exportJob.value = { status: 'success', progress: PROGRESS.COMPLETE, error: null }
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
          exportJob.value.progress = scaledProgress
        },
        getPdfBlob,
        bookmarks: store.bookmarksTree,
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
        exportJob.value.progress = EXPORT_PROGRESS.COMPRESSION_START
        let result
        try {
          result = await compressPdf(pdfBytes, {
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
        exportJob.value.progress = EXPORT_PROGRESS.COMPRESSION_END
      }

      exportJob.value.progress = PROGRESS.COMPLETE

      const pdfFilename = `${filename}.pdf`
      exportJob.value = { status: 'success', progress: PROGRESS.COMPLETE, error: null }
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

      exportJob.value = {
        status: 'error',
        progress: PROGRESS.MIN,
        error: documentError.message,
        errorCode: documentError.code,
      }
      return { ok: false, error: documentError }
    }
  }

  function getSuggestedFilename(): string {
    const sources = store.sourceFileList

    if (sources.length === 0) {
      return 'document'
    }

    if (sources.length === 1 && sources[0]) {
      const name = sources[0].filename.replace(/\.pdf$/i, '')
      return `${name}-edited`
    }

    return 'merged-document'
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
    importJob,
    exportJob,
    importFiles,
    generateRawPdf,
    exportDocument,
    clearExportError,
    getSuggestedFilename,
    getEstimatedSize,
    parsePageRange,
    validatePageRange,
    getPdfDocument,
    getPdfBlob,
  }
}

export type DocumentService = ReturnType<typeof useDocumentService>
export type {
  ExportOptions,
  ExportResult,
  ExportMetadata,
  GeneratorOptions,
} from '@/domain/document/export'
