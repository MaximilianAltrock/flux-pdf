import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { useCommandManager } from '@/composables/useCommandManager'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useMobile } from '@/composables/useMobile'
import { useFileHandler } from '@/composables/useFileHandler'
import { usePdfExport } from '@/composables/usePdfExport'
import {
  RotatePagesCommand,
  DuplicatePagesCommand,
  DeletePagesCommand,
  AddPagesCommand,
  RemoveSourceCommand,
} from '@/commands'
import { UserAction } from '@/types/actions'
import type { PageReference } from '@/types'
import type { AppState } from './useAppState'
import { useThumbnailRenderer } from './useThumbnailRenderer'

/**
 * Centralized action handlers for the application
 * All business logic lives here, keeping components thin
 */
export function useAppActions(state: AppState) {
  const store = useDocumentStore()
  const { clearAll } = usePdfManager()
  const { execute, clearHistory, undo } = useCommandManager()
  const { clearCache } = useThumbnailRenderer()
  const toast = useToast()
  const { confirmDelete, confirmClearWorkspace } = useConfirm()
  const { isMobile, haptic, shareFile, canShareFiles } = useMobile()
  const { handleFiles } = useFileHandler()
  const { generateRawPdf } = usePdfExport()

  // ============================================
  // File Handling
  // ============================================

  /**
   * Handle file input change event
   */
  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      handleFiles(input.files)
      state.clearFileInput()
    }
  }

  /**
   * Handle files dropped or selected
   */
  async function handleFilesSelected(files: FileList) {
    await handleFiles(files)
  }

  /**
   * Handle source file dropped from SourceRail onto grid
   */
  function handleSourceDropped(sourceId: string) {
    const sourceFile = store.sources.get(sourceId)
    if (!sourceFile) return

    const groupId = crypto.randomUUID()
    const newPages: PageReference[] = []

    for (let i = 0; i < sourceFile.pageCount; i++) {
      newPages.push({
        id: crypto.randomUUID(),
        sourceFileId: sourceFile.id,
        sourcePageIndex: i,
        rotation: 0,
        groupId,
      })
    }

    execute(new AddPagesCommand(sourceFile, newPages, false))
  }

  // ============================================
  // Export Handling
  // ============================================

  /**
   * Handle export action (detects mobile vs desktop flow)
   */
  async function handleExport() {
    if (isMobile.value && canShareFiles.value) {
      await handleMobileExport()
    } else {
      state.openExportModal(false)
    }
  }

  /**
   * Mobile-specific export with native share sheet
   */
  async function handleMobileExport() {
    try {
      store.setLoading(true, 'Generating PDF...')

      const pagesToExport = store.pages.filter((p) => !p.isDivider)
      if (pagesToExport.length === 0) {
        throw new Error('No pages to export')
      }

      const filename = store.projectTitle || 'document'
      const pdfBytes = await generateRawPdf(pagesToExport, { compress: true })
      const file = new File([pdfBytes as BlobPart], `${filename}.pdf`, {
        type: 'application/pdf',
      })

      store.setLoading(false)

      const result = await shareFile(file, filename)
      if (result.shared) {
        toast.success('Shared successfully')
      } else if (result.downloaded) {
        toast.success('PDF downloaded')
      }
    } catch (error) {
      store.setLoading(false)
      toast.error('Export failed', error instanceof Error ? error.message : 'Export failed')
    }
  }

  /**
   * Handle export selected pages action
   */
  function handleExportSelected() {
    state.openExportModal(true)
  }

  /**
   * Handle export success callback
   */
  function handleExportSuccess() {
    toast.success('PDF Exported')
  }

  // ============================================
  // Page Actions
  // ============================================

  /**
   * Handle page preview action
   */
  function handlePagePreview(pageRef: PageReference) {
    state.openPreviewModal(pageRef)
  }

  /**
   * Handle delete selected pages action
   */
  async function handleDeleteSelected() {
    if (store.selectedCount === 0) return

    // Desktop requires confirmation
    if (!isMobile.value) {
      const confirmed = await confirmDelete(store.selectedCount, 'page')
      if (!confirmed) return
    }

    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new DeletePagesCommand(selectedIds))
    store.clearSelection()

    if (isMobile.value) {
      haptic('medium')
      state.exitMobileSelectionMode()
    }

    toast.success(
      'Pages deleted',
      `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} removed`,
      { label: 'UNDO', onClick: () => undo() },
    )
  }

  /**
   * Handle duplicate selected pages action
   */
  function handleDuplicateSelected() {
    if (store.selectedCount === 0) return

    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new DuplicatePagesCommand(selectedIds))

    if (isMobile.value) {
      haptic('light')
    }

    toast.success('Pages duplicated')
  }

  /**
   * Handle rotate selected pages action
   */
  function handleRotateSelected(degrees: 90 | -90) {
    if (store.selectedCount === 0) return

    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new RotatePagesCommand(selectedIds, degrees))

    if (isMobile.value) {
      haptic('light')
    }
  }

  // ============================================
  // Source Management
  // ============================================

  /**
   * Handle remove source file action
   */
  async function handleRemoveSource(sourceId: string) {
    const source = store.sources.get(sourceId)
    if (!source) return

    const relatedPages = store.pages.filter((p) => p.sourceFileId === sourceId)

    if (!isMobile.value) {
      const confirmed = await confirmDelete(relatedPages.length, 'page')
      if (!confirmed) return
    }

    execute(new RemoveSourceCommand(source, store.pages))

    toast.success('File removed', undefined, {
      label: 'UNDO',
      onClick: () => undo(),
    })
  }

  // ============================================
  // Project Management
  // ============================================

  /**
   * Handle new project action (clears workspace)
   */
  async function handleNewProject() {
    const confirmed = await confirmClearWorkspace()
    if (!confirmed) return
    // A. Wipe the Database and Store
    await clearAll()
    // B. Wipe the Undo Stack
    clearHistory()
    // C. Wipe the Visual Cache
    clearCache()
    toast.info('Workspace Cleared')
  }

  // ============================================
  // Context Menu Actions
  // ============================================

  /**
   * Handle context menu action on a page
   */
  function handleContextAction(action: string, pageRef: PageReference) {
    // Ensure the page is selected before acting
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
        handleRotateSelected(-90)
        break
      case UserAction.ROTATE_RIGHT:
        handleRotateSelected(90)
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
    }
  }

  /**
   * Handle command palette action
   */
  function handleCommandAction(action: string) {
    state.closeCommandPalette()

    switch (action) {
      case UserAction.ADD_FILES:
        state.openFileDialog()
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
      case UserAction.NEW_PROJECT:
        handleNewProject()
        break
      case UserAction.PREVIEW:
        if (store.selectedCount === 1) {
          const id = Array.from(store.selection.selectedIds)[0]
          const page = store.pages.find((p) => p.id === id)
          if (page) handlePagePreview(page)
        }
        break
    }
  }

  // ============================================
  // Mobile-Specific Actions
  // ============================================

  /**
   * Handle mobile add files action
   */
  function handleMobileAddFiles() {
    state.openFileDialog()
  }

  /**
   * Handle mobile take photo action
   */
  function handleMobileTakePhoto() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files) handleFiles(files)
    }
    input.click()
  }

  // ============================================
  // Zoom Actions
  // ============================================

  function zoomIn() {
    store.zoomIn()
  }

  function zoomOut() {
    store.zoomOut()
  }

  return {
    // File Handling
    handleFileInputChange,
    handleFilesSelected,
    handleSourceDropped,

    // Export
    handleExport,
    handleExportSelected,
    handleExportSuccess,

    // Page Actions
    handlePagePreview,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRotateSelected,

    // Source Management
    handleRemoveSource,

    // Project Management
    handleNewProject,

    // Context/Command Actions
    handleContextAction,
    handleCommandAction,

    // Mobile Actions
    handleMobileAddFiles,
    handleMobileTakePhoto,

    // Zoom
    zoomIn,
    zoomOut,
  }
}

// Export type for use in layouts
export type AppActions = ReturnType<typeof useAppActions>
