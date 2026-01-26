import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROGRESS, ROTATION_DEFAULT_DEGREES, ROTATION_DELTA_DEGREES } from '@/constants'
import { createPinia, setActivePinia } from 'pinia'
import { useAppActions } from '@/composables/useAppActions'
import { useAppState } from '@/composables/useAppState'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import type { PageReference, SourceFile } from '@/types'

const mocks = vi.hoisted(() => {
  const mobileState = { value: false }
  const canShareFiles = { value: false }
  const exportJob = {
    value: null as
      | {
          status: string
          progress: number
          error: null
          errorCode: null
        }
      | null,
  }

  return {
    toast: {
      success: vi.fn(),
      destructive: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    },
    confirmDelete: vi.fn().mockResolvedValue(true),
    confirm: vi.fn().mockResolvedValue(true),
    mobileState,
    canShareFiles,
    haptic: vi.fn(),
    shareFile: vi.fn().mockResolvedValue({ shared: false, downloaded: false }),
    exportJob,
  }
})

vi.mock('@/composables/useToast', () => ({
  useToast: () => mocks.toast,
}))

vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({
    confirmDelete: mocks.confirmDelete,
    confirm: mocks.confirm,
  }),
}))

vi.mock('@/composables/useMobile', () => ({
  useMobile: () => ({
    isMobile: mocks.mobileState,
    canShareFiles: mocks.canShareFiles,
    haptic: mocks.haptic,
    shareFile: mocks.shareFile,
  }),
}))

vi.mock('@/composables/useDocumentService', () => ({
  useDocumentService: () => ({
    importFiles: vi.fn(),
    generateRawPdf: vi.fn(),
    exportDocument: vi.fn(),
    exportJob: mocks.exportJob,
    getSuggestedFilename: vi.fn(),
    getEstimatedSize: vi.fn(),
    clearExportError: vi.fn(),
    parsePageRange: vi.fn(),
    validatePageRange: vi.fn(),
  }),
}))

vi.mock('@/composables/useProjectManager', () => ({
  useProjectManager: () => ({
    createProject: vi.fn().mockResolvedValue({ id: 'project-1' }),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const makeSource = (id: string, pageCount: number): SourceFile => ({
  id,
  filename: `${id}.pdf`,
  pageCount,
  fileSize: pageCount * 1000,
  addedAt: Date.now(),
  color: '#111111',
  pageMetaData: Array.from({ length: pageCount }, () => ({
    width: 612,
    height: 792,
    rotation: 0,
  })),
  isImageSource: false,
})

const makePages = (sourceId: string, count: number): PageReference[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${sourceId}-p${index + 1}`,
    sourceFileId: sourceId,
    sourcePageIndex: index,
    rotation: ROTATION_DEFAULT_DEGREES,
    groupId: sourceId,
  }))

const historyCount = (actions: ReturnType<typeof useAppActions>) =>
  actions.historyList.value.length - 1

const setupActions = (pageCount = 2) => {
  const store = useDocumentStore()
  const state = useAppState()
  const actions = useAppActions(state)

  const source = makeSource('source-1', pageCount)
  const pages = makePages(source.id, pageCount)
  store.addSourceFile(source)
  store.addPages(pages)

  return { store, state, actions, pages }
}

beforeEach(() => {
  setActivePinia(createPinia())
  useCommandManager().clearHistory()
  mocks.mobileState.value = false
  mocks.canShareFiles.value = false
  mocks.exportJob.value = {
    status: 'idle',
    progress: PROGRESS.MIN,
    error: null,
    errorCode: null,
  }
  vi.clearAllMocks()
})

describe('useAppActions history integration', () => {
  it('tracks rotate actions in history', () => {
    const { store, actions } = setupActions(1)
    const pageId = store.contentPages[0]!.id

    store.selectPage(pageId, false)
    actions.handleRotateSelected(ROTATION_DELTA_DEGREES.RIGHT)

    expect(historyCount(actions)).toBe(1)
    expect(store.contentPages[0]?.rotation).toBe(ROTATION_DELTA_DEGREES.RIGHT)

    actions.undo()
    expect(store.contentPages[0]?.rotation).toBe(ROTATION_DEFAULT_DEGREES)

    actions.redo()
    expect(store.contentPages[0]?.rotation).toBe(ROTATION_DELTA_DEGREES.RIGHT)
  })

  it('tracks duplicate actions in history', () => {
    const { store, actions } = setupActions(2)
    const pageId = store.contentPages[0]!.id
    const initialCount = store.pages.length

    store.selectPage(pageId, false)
    actions.handleDuplicateSelected()

    expect(historyCount(actions)).toBe(1)
    expect(store.pages.length).toBe(initialCount + 1)

    actions.undo()
    expect(store.pages.length).toBe(initialCount)

    actions.redo()
    expect(store.pages.length).toBe(initialCount + 1)
  })

  it('tracks delete actions in history', async () => {
    const { store, actions } = setupActions(2)
    const pageId = store.contentPages[0]!.id
    const initialCount = store.pages.length

    store.selectPage(pageId, false)
    await actions.handleDeleteSelected()

    expect(mocks.confirmDelete).toHaveBeenCalledTimes(1)
    expect(historyCount(actions)).toBe(1)
    expect(store.pages.length).toBe(initialCount - 1)

    actions.undo()
    expect(store.pages.length).toBe(initialCount)
  })

  it('tracks reorder actions in history', () => {
    const { store, actions } = setupActions(3)
    const previousOrder = [...store.pages]
    const nextOrder = [...store.pages].reverse()

    actions.handleReorderPages(previousOrder, nextOrder)

    expect(historyCount(actions)).toBe(1)
    expect(store.pages.map((page) => page.id)).toEqual(nextOrder.map((page) => page.id))

    actions.undo()
    expect(store.pages.map((page) => page.id)).toEqual(previousOrder.map((page) => page.id))
  })

  it('tracks split actions in history', () => {
    const { store, actions } = setupActions(2)
    const initialCount = store.pages.length

    actions.handleSplitGroup(1)

    expect(historyCount(actions)).toBe(1)
    expect(store.pages.length).toBe(initialCount + 1)
    expect(store.pages[1]?.isDivider).toBe(true)

    actions.undo()
    expect(store.pages.length).toBe(initialCount)
    expect(store.pages.some((page) => page.isDivider)).toBe(false)
  })

  it('does not add history for selection and UI actions', () => {
    const { store, state, actions } = setupActions(2)
    const pageA = store.contentPages[0]!
    const pageB = store.contentPages[1]!

    actions.selectPage(pageA.id, false)
    actions.togglePageSelection(pageB.id)
    actions.setCurrentTool('razor')
    actions.zoomIn()
    actions.handlePagePreview(pageA)

    expect(historyCount(actions)).toBe(0)
    expect(state.showPreviewModal.value).toBe(true)

    actions.handleClosePreview()
    expect(state.showPreviewModal.value).toBe(false)
  })
})
