import { DEFAULT_PROJECT_TITLE, PROGRESS } from '@/shared/constants'
import type { DocumentMetadata } from '@/shared/types'
import type { Result } from '@/shared/types/result'
import type { JobState } from '@/shared/types/jobs'
import { buildOutlineForImport } from '@/domains/document/domain/outline'
import { getImportErrorMessage, makeImportError } from '@/domains/import/domain/errors'
import { loadPdfFiles } from '@/domains/import/infrastructure/import'
import { addPagesBatch, addSources } from '@/domains/document/application/use-cases'
import type {
  ImportOptions,
  ImportSummary,
  ImportServiceDeps,
} from '@/domains/import/application/import-service'

export function createDocumentImportService(deps: ImportServiceDeps) {
  const store = deps.documentStore
  const history = deps.historyStore
  const ui = deps.ui
  const settings = deps.settings

  const setLoading = (loading: boolean, message?: string) => {
    ui?.setLoading?.(loading, message)
  }

  const setImportJob = (job: JobState) => {
    if (ui?.importJob) ui.importJob.value = job
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
        const addPages = options.addPages !== false

        if (addPages) {
          const addPageEntries = successes.flatMap((result) => {
            if (!result.sourceFile || !result.pageRefs) return []
            return [{ sourceFile: result.sourceFile, pages: result.pageRefs, shouldAddSource: true }]
          })
          if (addPageEntries.length > 0) {
            addPagesBatch(history, addPageEntries, `Import ${addPageEntries.length} files`)
          }
        } else {
          const sourceFiles = successes.flatMap((result) => (result.sourceFile ? [result.sourceFile] : []))
          if (sourceFiles.length > 0) {
            addSources(history, sourceFiles, `Register ${sourceFiles.length} sources`)
          }
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
      const importError = makeImportError('IMPORT_FAILED', message, error)
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

  return {
    importFiles,
    importJob: ui?.importJob,
  }
}

export type DocumentImportService = ReturnType<typeof createDocumentImportService>
