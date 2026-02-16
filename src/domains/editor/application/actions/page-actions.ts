import type { Ref } from 'vue'
import {
  DIFF_REQUIRED_SELECTION,
  type RotationDelta,
} from '@/shared/constants'
import {
  addRedaction as addRedactionUseCase,
  deletePages as deletePagesUseCase,
  deleteRedaction as deleteRedactionUseCase,
  deleteRedactions as deleteRedactionsUseCase,
  duplicatePages as duplicatePagesUseCase,
  removeSource as removeSourceUseCase,
  reorderPages as reorderPagesUseCase,
  resizePages as resizePagesUseCase,
  rotatePages as rotatePagesUseCase,
  splitGroup as splitGroupUseCase,
  updateRedaction as updateRedactionUseCase,
} from '@/domains/document/application/use-cases'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useHistoryStore } from '@/domains/history/store/history.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { PageEntry, PageReference, RedactionMark } from '@/shared/types'
import type { PreflightFix } from '@/shared/types/linter'

interface PageActionsToast {
  success: (
    title: string,
    detail?: string,
    action?: { label: string; onClick: () => void },
  ) => unknown
  warning: (title: string, detail?: string) => unknown
}

export interface CreatePageActionsDeps {
  store: ReturnType<typeof useDocumentStore>
  history: ReturnType<typeof useHistoryStore>
  ui: ReturnType<typeof useUiStore>
  toast: PageActionsToast
  isMobile: Ref<boolean>
  haptic: (pattern: 'light' | 'medium' | 'heavy' | 'success') => void
  confirmDelete: (itemCount: number, itemName?: string) => Promise<boolean>
}

export function createPageActions({
  store,
  history,
  ui,
  toast,
  isMobile,
  haptic,
  confirmDelete,
}: CreatePageActionsDeps) {
  function handleReorderPages(previousOrder: PageEntry[], nextOrder: PageEntry[]) {
    reorderPagesUseCase(history, previousOrder, nextOrder)
  }

  function handleSplitGroup(index: number) {
    if (isMobile.value) {
      haptic('medium')
    }
    splitGroupUseCase(history, index)
  }

  function handlePagePreview(pageRef: PageReference) {
    store.selectPage(pageRef.id, false)
    ui.openPreviewModal(pageRef)
  }

  function handleClosePreview() {
    const pageRef = ui.previewPageRef
    if (pageRef) {
      store.selectPage(pageRef.id, false)
    }
    ui.closePreviewModal()
  }

  async function handleDeleteSelected() {
    if (store.selectedCount === 0) return

    if (!isMobile.value) {
      const confirmed = await confirmDelete(store.selectedCount, 'page')
      if (!confirmed) return
    }

    const selectedIds = Array.from(store.selection.selectedIds)
    deletePagesUseCase(history, selectedIds)
    store.clearSelection()

    if (isMobile.value) {
      haptic('medium')
      ui.exitMobileSelectionMode()
    }

    toast.success(
      'Pages deleted',
      `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} removed`,
      { label: 'UNDO', onClick: () => history.undo() },
    )
  }

  function handleDuplicateSelected() {
    if (store.selectedCount === 0) return

    const selectedIds = Array.from(store.selection.selectedIds)
    duplicatePagesUseCase(history, selectedIds)

    if (isMobile.value) {
      haptic('light')
    }

    toast.success('Pages duplicated')
  }

  function handleRotateSelected(degrees: RotationDelta) {
    if (store.selectedCount === 0) return

    const selectedIds = Array.from(store.selection.selectedIds)
    rotatePagesUseCase(history, selectedIds, degrees)

    if (isMobile.value) {
      haptic('light')
    }
  }

  function handleDiffSelected() {
    if (store.selectedCount !== DIFF_REQUIRED_SELECTION) {
      toast.warning(
        `Diff requires ${DIFF_REQUIRED_SELECTION} pages`,
        `You have ${store.selectedCount} selected. Select exactly ${DIFF_REQUIRED_SELECTION} pages to compare.`,
      )
      return
    }

    const selectedIds = Array.from(store.selection.selectedIds)
    const pageA = store.contentPages.find((p) => p.id === selectedIds[0])
    const pageB = store.contentPages.find((p) => p.id === selectedIds[1])

    if (pageA && pageB) {
      ui.openDiffModal(pageA, pageB)
    }
  }

  function addRedaction(pageId: string, redaction: RedactionMark) {
    addRedactionUseCase(history, pageId, redaction)
  }

  function updateRedaction(pageId: string, previous: RedactionMark, next: RedactionMark) {
    updateRedactionUseCase(history, pageId, previous, next)
  }

  function deleteRedaction(pageId: string, redaction: RedactionMark) {
    deleteRedactionUseCase(history, pageId, redaction)
  }

  function deleteRedactions(pageId: string, redactions: RedactionMark[]) {
    deleteRedactionsUseCase(history, pageId, redactions)
  }

  function applyPreflightFix(fix: PreflightFix, pageIds: string[]) {
    if (!fix) return

    switch (fix.id) {
      case 'resize': {
        if (!fix.targets || fix.targets.length === 0) return
        resizePagesUseCase(history, fix.targets)
        break
      }
      case 'rotate': {
        if (!pageIds || pageIds.length === 0) return
        rotatePagesUseCase(history, pageIds, fix.rotation)
        break
      }
      case 'edit-metadata': {
        ui.setInspectorTab('metadata')
        break
      }
      default:
        break
    }
  }

  async function handleRemoveSource(sourceId: string) {
    const source = store.sources.get(sourceId)
    if (!source) return

    const relatedPages = store.contentPages.filter((p) => p.sourceFileId === sourceId)

    if (!isMobile.value) {
      const confirmed = await confirmDelete(relatedPages.length, 'page')
      if (!confirmed) return
    }

    removeSourceUseCase(history, source, store.pages)

    toast.success('File removed', undefined, {
      label: 'UNDO',
      onClick: () => history.undo(),
    })
  }

  function selectPage(pageId: string, addToSelection = false) {
    store.selectPage(pageId, addToSelection)
  }

  function togglePageSelection(pageId: string) {
    store.togglePageSelection(pageId)
    if (isMobile.value && store.selectedCount === 0) {
      ui.exitMobileSelectionMode()
    }
  }

  function selectRange(fromId: string, toId: string) {
    store.selectRange(fromId, toId)
  }

  function selectAllPages() {
    store.selectAll()
    if (isMobile.value) {
      haptic('light')
    }
  }

  function clearSelection() {
    store.clearSelection()
    if (isMobile.value) {
      haptic('light')
      ui.exitMobileSelectionMode()
    }
  }

  function clearSelectionKeepMode() {
    store.clearSelection()
    if (isMobile.value) {
      haptic('light')
    }
  }

  function enterMobileSelectionMode() {
    ui.enterMobileSelectionMode()
  }

  function exitMobileSelectionMode() {
    ui.exitMobileSelectionMode()
    store.clearSelection()
  }

  function enterMobileMoveMode() {
    if (store.selectedCount === 0) return
    ui.enterMobileMoveMode()
    haptic('medium')
  }

  function exitMobileMoveMode() {
    ui.exitMobileMoveMode()
  }

  function enterMobileSplitMode() {
    if (isMobile.value) {
      haptic('medium')
    }
    exitMobileSelectionMode()
    ui.setCurrentTool('razor')
  }

  function exitMobileSplitMode() {
    ui.setCurrentTool('select')
  }

  function handleMoveSelectedToPosition(targetIndex: number) {
    if (store.selectedCount === 0) return

    const selectedIds = new Set(store.selection.selectedIds)
    const allPages = store.pages
    const selectedPages = allPages.filter((p) => selectedIds.has(p.id))
    const otherPages = allPages.filter((p) => !selectedIds.has(p.id))

    let adjustedIndex = targetIndex
    for (let i = 0; i < targetIndex && i < allPages.length; i++) {
      const page = allPages[i]
      if (page && selectedIds.has(page.id)) {
        adjustedIndex--
      }
    }

    const newOrder = [
      ...otherPages.slice(0, adjustedIndex),
      ...selectedPages,
      ...otherPages.slice(adjustedIndex),
    ]

    const isSameOrder =
      newOrder.length === allPages.length &&
      newOrder.every((page, index) => page.id === allPages[index]?.id)

    if (isSameOrder) {
      ui.exitMobileMoveMode()
      return
    }

    handleReorderPages([...allPages], newOrder)
    haptic('light')
    ui.exitMobileMoveMode()
  }

  return {
    handleReorderPages,
    handleSplitGroup,
    handlePagePreview,
    handleClosePreview,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRotateSelected,
    handleDiffSelected,
    addRedaction,
    updateRedaction,
    deleteRedaction,
    deleteRedactions,
    applyPreflightFix,
    handleRemoveSource,
    selectPage,
    togglePageSelection,
    selectRange,
    selectAllPages,
    clearSelection,
    clearSelectionKeepMode,
    enterMobileSelectionMode,
    exitMobileSelectionMode,
    enterMobileMoveMode,
    exitMobileMoveMode,
    enterMobileSplitMode,
    exitMobileSplitMode,
    handleMoveSelectedToPosition,
  }
}
