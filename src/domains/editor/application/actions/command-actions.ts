import { ROTATION_DELTA_DEGREES, type RotationDelta } from '@/shared/constants'
import { UserAction } from '@/shared/types/actions'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { PageReference } from '@/shared/types'

export interface CreateCommandActionsDeps {
  store: Pick<
    ReturnType<typeof useDocumentStore>,
    'selection' | 'contentPages' | 'selectedCount' | 'selectPage' | 'selectAll'
  >
  ui: Pick<ReturnType<typeof useUiStore>, 'closeCommandPalette'>
  openFileDialog: () => void
  handlePagePreview: (pageRef: PageReference) => void
  handleDuplicateSelected: () => void
  handleRotateSelected: (degrees: RotationDelta) => void
  handleExportSelected: () => void
  handleDeleteSelected: () => void | Promise<void>
  handleDiffSelected: () => void
  handleExport: () => void | Promise<void>
  handleNewProject: () => void | Promise<void>
}

export function createCommandActions({
  store,
  ui,
  openFileDialog,
  handlePagePreview,
  handleDuplicateSelected,
  handleRotateSelected,
  handleExportSelected,
  handleDeleteSelected,
  handleDiffSelected,
  handleExport,
  handleNewProject,
}: CreateCommandActionsDeps) {
  function handleContextAction(action: UserAction, pageRef: PageReference) {
    if (!store.selection.selectedIds.has(pageRef.id)) {
      store.selectPage(pageRef.id, false)
    }

    switch (action) {
      case UserAction.PREVIEW:
        handlePagePreview(pageRef)
        break
      case UserAction.DUPLICATE:
        handleDuplicateSelected()
        break
      case UserAction.ROTATE_LEFT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.LEFT)
        break
      case UserAction.ROTATE_RIGHT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.RIGHT)
        break
      case UserAction.SELECT_ALL:
        store.selectAll()
        break
      case UserAction.EXPORT_SELECTED:
        handleExportSelected()
        break
      case UserAction.DELETE:
        handleDeleteSelected()
        break
      case UserAction.DIFF:
        handleDiffSelected()
        break
      default:
        break
    }
  }

  function handleCommandAction(action: UserAction) {
    ui.closeCommandPalette()

    switch (action) {
      case UserAction.ADD_FILES:
        openFileDialog()
        break
      case UserAction.EXPORT:
        handleExport()
        break
      case UserAction.EXPORT_SELECTED:
        handleExportSelected()
        break
      case UserAction.DELETE:
        handleDeleteSelected()
        break
      case UserAction.DUPLICATE:
        handleDuplicateSelected()
        break
      case UserAction.ROTATE_LEFT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.LEFT)
        break
      case UserAction.ROTATE_RIGHT:
        handleRotateSelected(ROTATION_DELTA_DEGREES.RIGHT)
        break
      case UserAction.NEW_PROJECT:
        handleNewProject()
        break
      case UserAction.DIFF:
        handleDiffSelected()
        break
      case UserAction.PREVIEW:
        if (store.selectedCount === 1) {
          const id = Array.from(store.selection.selectedIds)[0]
          const page = store.contentPages.find((p) => p.id === id)
          if (page) handlePagePreview(page)
        }
        break
      case UserAction.SELECT_ALL:
        store.selectAll()
        break
      default:
        break
    }
  }

  return {
    handleContextAction,
    handleCommandAction,
  }
}
