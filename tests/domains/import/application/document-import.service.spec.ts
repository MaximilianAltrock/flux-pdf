import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROGRESS } from '@/shared/constants'
import { createDocumentImportService } from '@/domains/import/application/document-import.service'
import { createJobState } from '@/shared/types/jobs'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { HistoryBatchCommandExecutor } from '@/domains/history/application'
import type { FileUploadResult, PageReference, SourceFile } from '@/shared/types'

const importMocks = vi.hoisted(() => ({
  loadPdfFiles: vi.fn(),
  addPagesBatch: vi.fn(),
  addSources: vi.fn(),
}))

vi.mock('@/domains/import/infrastructure/import', () => ({
  loadPdfFiles: importMocks.loadPdfFiles,
}))

vi.mock('@/domains/document/application/use-cases', () => ({
  addPagesBatch: importMocks.addPagesBatch,
  addSources: importMocks.addSources,
}))

function createHarness() {
  const importJob = ref(createJobState())
  const setLoading = vi.fn()
  const setMetadata = vi.fn()
  const setOutlineTree = vi.fn()

  const store = {
    metadata: {
      title: 'Untitled Project',
      author: '',
      subject: '',
      keywords: [],
    },
    metadataDirty: false,
    outlineTree: [],
    sources: new Map(),
    setMetadata,
    setOutlineTree,
  } as unknown as DocumentState

  const history = {
    executeBatch: vi.fn(),
  } as unknown as HistoryBatchCommandExecutor

  const service = createDocumentImportService({
    documentStore: store,
    historyStore: history,
    ui: {
      importJob,
      setLoading,
    },
    settings: {
      autoGenerateOutlineSinglePage: ref(true),
    },
  })

  return {
    service,
    store,
    history,
    importJob,
    setLoading,
    setMetadata,
    setOutlineTree,
  }
}

function createImportSuccess(): FileUploadResult {
  const pageRefs: PageReference[] = [
    {
      id: 'page-1',
      sourceFileId: 'source-1',
      sourcePageIndex: 0,
      rotation: 0,
    },
  ]

  const sourceFile: SourceFile = {
    id: 'source-1',
    filename: 'imported.pdf',
    pageCount: 1,
    fileSize: 128,
    addedAt: Date.now(),
    color: 'zinc',
    pageMetaData: [],
    metadata: {
      title: 'Imported Title',
      author: 'Imported Author',
      subject: '',
      keywords: [],
      pdfVersion: '1.7',
    },
    outline: [],
  }

  return {
    success: true,
    sourceFile,
    pageRefs,
  }
}

describe('document import service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates import job state and preserves metadata/outline import behavior', async () => {
    const harness = createHarness()
    const success = createImportSuccess()
    importMocks.loadPdfFiles.mockImplementationOnce(async () => {
      expect(harness.importJob.value).toMatchObject({
        status: 'running',
        progress: PROGRESS.MIN,
        error: null,
      })
      return [success]
    })

    const files = [new File(['x'], 'imported.pdf', { type: 'application/pdf' })]
    const result = await harness.service.importFiles(files)

    expect(result.ok).toBe(true)
    expect(harness.importJob.value).toMatchObject({
      status: 'success',
      progress: PROGRESS.COMPLETE,
      error: null,
    })
    expect(harness.setLoading).toHaveBeenNthCalledWith(1, true, 'Processing imported.pdf...')
    expect(harness.setLoading).toHaveBeenLastCalledWith(false, undefined)
    expect(importMocks.addPagesBatch).toHaveBeenCalledOnce()
    expect(importMocks.addSources).not.toHaveBeenCalled()
    expect(harness.setMetadata).toHaveBeenCalledWith({
      title: 'Imported Title',
      author: 'Imported Author',
      pdfVersion: '1.7',
    })
    expect(harness.setOutlineTree).toHaveBeenCalledOnce()
    const [outlineTree, markDirty] = harness.setOutlineTree.mock.calls[0]!
    expect(markDirty).toBe(false)
    expect(outlineTree).toEqual([
      expect.objectContaining({
        title: 'imported.pdf',
      }),
    ])
  })

  it('marks the import job as failed when loading throws', async () => {
    const harness = createHarness()
    importMocks.loadPdfFiles.mockRejectedValueOnce(new Error('boom'))

    const files = [new File(['x'], 'broken.pdf', { type: 'application/pdf' })]
    const result = await harness.service.importFiles(files)

    expect(result.ok).toBe(false)
    expect(harness.importJob.value).toMatchObject({
      status: 'error',
      progress: PROGRESS.MIN,
      error: 'Import failed',
      errorCode: 'IMPORT_FAILED',
    })
    expect(harness.setLoading).toHaveBeenLastCalledWith(false, undefined)
  })
})
