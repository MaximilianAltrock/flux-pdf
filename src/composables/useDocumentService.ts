import { ref, watch } from 'vue'
import JSZip from 'jszip'
import { db } from '@/db/db'
import type { StoredFile } from '@/db/db'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { AddPagesCommand, BatchCommand } from '@/commands'
import type { Command } from '@/commands/types'
import type { DocumentMetadata, FileUploadResult, PageEntry, PageReference } from '@/types'
import type { Result } from '@/types/result'
import { usePdfCompression } from '@/composables/usePdfCompression'
import { useDebounceFn } from '@vueuse/core'
import {
  loadPdfFiles,
  getPdfDocument,
  getPdfBlob,
  clearPdfCache,
} from '@/domain/document/import'
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
import { loadSession, persistSession } from '@/domain/document/session'

type JobStatus = 'idle' | 'running' | 'success' | 'error'

export interface JobState {
  status: JobStatus
  progress: number
  error: string | null
}

function createJobState(): JobState {
  return {
    status: 'idle',
    progress: 0,
    error: null,
  }
}

const importJob = ref<JobState>(createJobState())
const exportJob = ref<JobState>(createJobState())
const restoreJob = ref<JobState>(createJobState())
const isInitialized = ref(false)
let persistenceInitialized = false

export interface ImportSummary {
  results: FileUploadResult[]
  successes: FileUploadResult[]
  errors: FileUploadResult[]
  totalPages: number
}

export function useDocumentService() {
  const store = useDocumentStore()
  const { execute, serializeHistory, rehydrateHistory, getHistoryPointer, historyList } =
    useCommandManager()

  setupSessionPersistence()

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

  function setupSessionPersistence(): void {
    if (persistenceInitialized) return
    persistenceInitialized = true

    const saveSession = useDebounceFn(async () => {
      const bookmarksDirty = Boolean(store.bookmarksDirty)
      try {
        await persistSession({
          projectTitle: String(store.projectTitle ?? ''),
          activeSourceIds: Array.from(store.sources.keys()),
          pageMap: store.pages,
          history: serializeHistory(),
          historyPointer: getHistoryPointer(),
          zoom: store.zoom,
          bookmarksTree: store.bookmarksTree,
          bookmarksDirty,
          metadata: store.metadata,
          security: store.security,
          metadataDirty: store.metadataDirty,
        })
      } catch (error) {
        console.error('Failed to save session to IndexedDB:', error)
      }
    }, 1000)

    watch(
      [
        historyList,
        () => store.pages,
        () => store.projectTitle,
        () => store.zoom,
        () => store.bookmarksTree,
        () => store.bookmarksDirty,
        () => store.metadata,
        () => store.security,
        () => store.metadataDirty,
      ],
      () => {
        saveSession()
      },
      { deep: true },
    )
  }

  async function importFiles(files: FileList | File[]): Promise<Result<ImportSummary>> {
    const fileList = Array.from(files)
    if (fileList.length === 0) {
      return { ok: true, value: { results: [], successes: [], errors: [], totalPages: 0 } }
    }

    importJob.value = { status: 'running', progress: 0, error: null }
    const loadingLabel =
      fileList.length === 1
        ? `Processing ${fileList[0]?.name ?? 'file'}...`
        : `Processing ${fileList.length} files...`
    store.setLoading(true, loadingLabel)

    try {
      const results = await loadPdfFiles(fileList, { initialColorIndex: store.sources.size })
      for (const result of results) {
        if (result.success && result.sourceFile?.metadata) {
          maybeApplyMetadataFromSource(result.sourceFile.metadata)
        }
      }

      const successes = results.filter((r) => r.success)
      const errors = results.filter((r) => !r.success)

      if (successes.length > 0) {
        const commandsToRun: Command[] = []

        for (const result of successes) {
          if (result.sourceFile && result.pageRefs) {
            const cmd = new AddPagesCommand(result.sourceFile, result.pageRefs, true)
            commandsToRun.push(cmd)
          }
        }

        if (commandsToRun.length === 1) {
          execute(commandsToRun[0]!)
        } else if (commandsToRun.length > 1) {
          const batchName = `Import ${commandsToRun.length} files`
          const batchCmd = new BatchCommand(commandsToRun, batchName)
          execute(batchCmd)
        }
      }

      const totalPages = successes.reduce((sum, r) => sum + (r.sourceFile?.pageCount ?? 0), 0)

      importJob.value = { status: 'success', progress: 100, error: null }
      return { ok: true, value: { results, successes, errors, totalPages } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed'
      importJob.value = { status: 'error', progress: 0, error: message }
      return { ok: false, error: { message, cause: error } }
    } finally {
      store.setLoading(false)
    }
  }

  function clearExportError(): void {
    exportJob.value = { status: 'idle', progress: 0, error: null }
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
      const message = 'No pages to export'
      exportJob.value = { status: 'error', progress: 0, error: message }
      return { ok: false, error: { message } }
    }

    exportJob.value = { status: 'running', progress: 0, error: null }

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
          exportJob.value.progress = Math.round(((i + 1) / segments.length) * 80)
        }

        exportJob.value.progress = 90
        const zipContent = await zip.generateAsync({ type: 'uint8array' })
        exportJob.value.progress = 100

        downloadFile(zipContent, `${filename}.zip`, 'application/zip')

        exportJob.value = { status: 'success', progress: 100, error: null }
        return {
          ok: true,
          value: { filename: `${filename}.zip`, size: zipContent.byteLength },
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
              ? Math.round(val * 0.7)
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
        exportJob.value.progress = 75
        const { compressPdf } = usePdfCompression()
        const result = await compressPdf(pdfBytes, { quality: options.compressionQuality })
        pdfBytes = result.data

        if (!isFullSourceExport) {
          originalSize = result.originalSize
        }

        if (originalSize > 0) {
          compressionRatio = 1 - pdfBytes.byteLength / originalSize
        }
        exportJob.value.progress = 95
      }

      exportJob.value.progress = 100
      downloadFile(pdfBytes, `${filename}.pdf`, 'application/pdf')

      exportJob.value = { status: 'success', progress: 100, error: null }
      return {
        ok: true,
        value: {
          filename: `${filename}.pdf`,
          size: pdfBytes.byteLength,
          originalSize: originalSize !== pdfBytes.byteLength ? originalSize : undefined,
          compressionRatio: compressionRatio > 0 ? compressionRatio : undefined,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      exportJob.value = { status: 'error', progress: 0, error: message }
      return { ok: false, error: { message, cause: error } }
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

  function getEstimatedSize(pagesToEstimate?: PageReference[]): number {
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

  function downloadFile(data: Uint8Array, filename: string, mimeType = 'application/pdf'): void {
    const arrayBuffer =
      data.buffer instanceof ArrayBuffer
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data.slice().buffer

    const blob = new Blob([arrayBuffer], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function restoreSession(): Promise<Result<null>> {
    if (isInitialized.value) return { ok: true, value: null }

    restoreJob.value = { status: 'running', progress: 0, error: null }
    store.setLoading(true, 'Restoring session...')

    try {
      const session = await loadSession()
      const activeIds = session?.activeSourceIds

      let filesToLoad: StoredFile[] = []

      if (activeIds) {
        filesToLoad = await db.files.where('id').anyOf(activeIds).toArray()
      } else if (!session) {
        filesToLoad = []
      } else {
        filesToLoad = await db.files.toArray()
      }

      filesToLoad.forEach((f) => {
        store.addSourceFile({
          id: f.id,
          filename: f.filename,
          fileSize: f.fileSize,
          pageCount: f.pageCount,
          addedAt: f.addedAt,
          color: f.color,
          outline: f.outline,
          metadata: f.metadata,
        })
      })

      if (session) {
        store.projectTitle = session.projectTitle
        store.setZoom(session.zoom)
        store.bookmarksDirty = session.bookmarksDirty ?? false
        store.setPages(session.pageMap)
        if (session.metadata) {
          store.setMetadata(session.metadata, false)
        }
        store.metadataDirty =
          session.metadataDirty ??
          (session.metadata ? !isDefaultMetadata(session.metadata as DocumentMetadata) : false)
        if (session.security) {
          store.setSecurity(session.security)
        }

        if (store.bookmarksDirty) {
          store.setBookmarksTree((session.bookmarksTree as any[]) ?? [], false)
        }
      }

      if (session?.history) {
        rehydrateHistory(session.history, session.historyPointer, session.updatedAt)
      } else {
        rehydrateHistory([], -1, session?.updatedAt)
      }

      restoreJob.value = { status: 'success', progress: 100, error: null }
      isInitialized.value = true
      return { ok: true, value: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed'
      restoreJob.value = { status: 'error', progress: 0, error: message }
      return { ok: false, error: { message, cause: error } }
    } finally {
      store.setLoading(false)
    }
  }

  async function clearWorkspace(): Promise<Result<null>> {
    try {
      await db.files.clear()
      await db.session.clear()
      clearPdfCache()
      store.reset()
      return { ok: true, value: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear workspace'
      return { ok: false, error: { message, cause: error } }
    }
  }

  async function removeSource(sourceId: string): Promise<Result<null>> {
    store.removeSourceFile(sourceId)
    return { ok: true, value: null }
  }

  return {
    importJob,
    exportJob,
    restoreJob,
    importFiles,
    generateRawPdf,
    exportDocument,
    clearExportError,
    getSuggestedFilename,
    getEstimatedSize,
    parsePageRange,
    validatePageRange,
    restoreSession,
    clearWorkspace,
    removeSource,
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
