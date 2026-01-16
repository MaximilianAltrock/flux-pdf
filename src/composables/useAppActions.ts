import { useDocumentStore } from '@/stores/document'
import {
  DIFF_REQUIRED_SELECTION,
  ROTATION_DEFAULT_DEGREES,
  ROTATION_DELTA_DEGREES,
  TIMEOUTS_MS,
  type RotationDelta,
} from '@/constants'
import { useCommandManager } from '@/composables/useCommandManager'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useMobile } from '@/composables/useMobile'
import { useDocumentService, type ExportOptions } from '@/composables/useDocumentService'
import { getImportErrorMessage } from '@/domain/document/errors'
import {
  RotatePagesCommand,
  DuplicatePagesCommand,
  DeletePagesCommand,
  AddPagesCommand,
  RemoveSourceCommand,
  ReorderPagesCommand,
  SplitGroupCommand,
} from '@/commands'
import { UserAction } from '@/types/actions'
import type {
  BookmarkNode,
  DocumentMetadata,
  PageEntry,
  PageReference,
  SecurityMetadata,
} from '@/types'
import type { AppState } from './useAppState'
import { useThumbnailRenderer } from './useThumbnailRenderer'

/**
 * Centralized action handlers for the application
 * All business logic lives here, keeping components thin
 */
export function useAppActions(state: AppState) {
  const store = useDocumentStore()
  const {
    execute,
    clearHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    undoName,
    redoName,
    historyList,
    jumpTo,
  } = useCommandManager()
  const { clearCache } = useThumbnailRenderer()
  const toast = useToast()
  const { confirmDelete, confirmClearWorkspace } = useConfirm()
  const { isMobile, haptic, shareFile, canShareFiles } = useMobile()
  const {
    importFiles,
    clearWorkspace,
    generateRawPdf,
    exportDocument: exportDocumentService,
    exportJob,
    getSuggestedFilename,
    getEstimatedSize,
    clearExportError,
    parsePageRange,
    validatePageRange,
    restoreSession,
  } = useDocumentService(undefined, {
    zoom: state.zoom,
    setZoom: state.setZoom,
    setLoading: state.setLoading,
  })

  function normalizeProjectTitle(value: string) {
    let next = value.trim()
    if (!next) next = 'Untitled Project'
    return next.replace(/[/\\:]/g, '-')
  }

  // ============================================
  // File Handling
  // ============================================

  /**
   * Handle file input change event
   */
  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      handleImport(input.files)
      state.clearFileInput()
    }
  }

  /**
   * Handle files dropped or selected
   */
  async function handleFilesSelected(files: FileList) {
    await handleImport(files)
  }

  async function handleImport(files: FileList | File[]) {
    const result = await importFiles(files)
    if (!result.ok) {
      toast.error('Failed to load files', result.error.message)
      return
    }

    const { successes, errors, totalPages } = result.value

    if (successes.length > 0) {
      toast.success(
        `Added ${successes.length} file${successes.length > 1 ? 's' : ''}`,
        `${totalPages} page${totalPages > 1 ? 's' : ''} added`,
      )
    }

    if (errors.length > 0) {
      const detail = errors
        .map((e) => {
          if (e.errorCode) {
            return getImportErrorMessage(e.errorCode, e.error)
          }
          return e.error
        })
        .filter((e): e is string => typeof e === 'string' && e.length > 0)
        .join(', ')

      toast.error(
        `Failed to load ${errors.length} file${errors.length > 1 ? 's' : ''}`,
        detail || 'Unknown error',
      )
    }
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
        rotation: ROTATION_DEFAULT_DEGREES,
        groupId,
      })
    }

    execute(new AddPagesCommand(sourceFile, newPages, false))
  }

  function downloadFile(data: Uint8Array, filename: string, mimeType: string): void {
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

    setTimeout(() => URL.revokeObjectURL(url), TIMEOUTS_MS.OBJECT_URL_REVOKE)
  }

  async function exportDocument(options: ExportOptions) {
    const result = await exportDocumentService(options)
    if (!result.ok) return result

    downloadFile(result.value.bytes, result.value.filename, result.value.mimeType)
    return result
  }

  /**
   * Handle reorder after drag-drop (undoable).
   */
  function handleReorderPages(previousOrder: PageEntry[], nextOrder: PageEntry[]) {
    execute(new ReorderPagesCommand(previousOrder, nextOrder))
  }

  /**
   * Handle section split (undoable).
   */
  function handleSplitGroup(index: number) {
    execute(new SplitGroupCommand(index))
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
      state.setLoading(true, 'Generating PDF...')

      const pagesToExport = store.contentPages
      if (pagesToExport.length === 0) {
        throw new Error('No pages to export')
      }

      const filename = store.projectTitle || 'document'
      const pdfResult = await generateRawPdf(pagesToExport, { compress: false })
      if (!pdfResult.ok) {
        throw new Error(pdfResult.error.message)
      }
      const pdfBytes = pdfResult.value
      const file = new File([pdfBytes as BlobPart], `${filename}.pdf`, {
        type: 'application/pdf',
      })

      state.setLoading(false)

      const result = await shareFile(file, filename)
      if (result.shared) {
        toast.success('Shared successfully')
      } else if (result.downloaded) {
        toast.success('PDF downloaded')
      }
    } catch (error) {
      state.setLoading(false)
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
    store.selectPage(pageRef.id, false)
    state.openPreviewModal(pageRef)
  }

  function handleClosePreview() {
    const pageRef = state.previewPageRef.value
    if (pageRef) {
      store.selectPage(pageRef.id, false)
    }
    state.closePreviewModal()
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
  function handleRotateSelected(degrees: RotationDelta) {
    if (store.selectedCount === 0) return

    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new RotatePagesCommand(selectedIds, degrees))

    if (isMobile.value) {
      haptic('light')
    }
  }

  /**
   * Handle Diff (Ghost Overlay) Action
   */
  function handleDiffSelected() {
    // 1. Validate
    if (store.selectedCount !== DIFF_REQUIRED_SELECTION) {
      // 2. Feedback (Crucial for the 'D' shortcut fix)
      toast.warning(
        `Diff requires ${DIFF_REQUIRED_SELECTION} pages`,
        `You have ${store.selectedCount} selected. Select exactly ${DIFF_REQUIRED_SELECTION} pages to compare.`,
      )
      return
    }

    // 3. Execute
    const selectedIds = Array.from(store.selection.selectedIds)
    const pageA = store.contentPages.find((p) => p.id === selectedIds[0])
    const pageB = store.contentPages.find((p) => p.id === selectedIds[1])

    if (pageA && pageB) {
      state.openDiffModal(pageA, pageB)
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

    const relatedPages = store.contentPages.filter((p) => p.sourceFileId === sourceId)

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
    const result = await clearWorkspace()
    if (!result.ok) {
      toast.error('Failed to clear workspace', result.error.message)
      return
    }
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
  function handleContextAction(action: UserAction, pageRef: PageReference) {
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

  /**
   * Handle command palette action
   */
  function handleCommandAction(action: UserAction) {
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
      if (files) handleImport(files)
    }
    input.click()
  }

  // ============================================
  // Zoom Actions
  // ============================================

  function zoomIn() {
    state.zoomIn()
  }

  function zoomOut() {
    state.zoomOut()
  }

  // ============================================
  // Selection + UI State
  // ============================================

  function selectPage(pageId: string, addToSelection = false) {
    store.selectPage(pageId, addToSelection)
  }

  function togglePageSelection(pageId: string) {
    store.togglePageSelection(pageId)
  }

  function selectRange(fromId: string, toId: string) {
    store.selectRange(fromId, toId)
  }

  function selectAllPages() {
    store.selectAll()
  }

  function clearSelection() {
    store.clearSelection()
  }

  function enterMobileSelectionMode() {
    state.enterMobileSelectionMode()
  }

  function exitMobileSelectionMode() {
    state.exitMobileSelectionMode()
    store.clearSelection()
  }

  // ============================================
  // Project / Metadata / Security
  // ============================================

  function setProjectTitleDraft(value: string) {
    if (store.isTitleLocked) return
    store.projectTitle = value
  }

  function commitProjectTitle(value?: string) {
    if (store.isTitleLocked) return
    store.projectTitle = normalizeProjectTitle(value ?? store.projectTitle)
  }

  function setCurrentTool(tool: 'select' | 'razor') {
    state.setCurrentTool(tool)
  }

  async function handleRestoreSession() {
    return restoreSession()
  }

  function setMetadata(next: Partial<DocumentMetadata>) {
    store.setMetadata(next)
  }

  function applyMetadataFromSource(sourceId: string) {
    const source = store.sources.get(sourceId)
    if (!source?.metadata) return
    store.setMetadata(source.metadata)
  }

  function addKeyword(keyword: string) {
    store.addKeyword(keyword)
  }

  function removeKeyword(keyword: string) {
    store.removeKeyword(keyword)
  }

  function setSecurity(next: Partial<SecurityMetadata>) {
    store.setSecurity(next)
  }

  function setBookmarksTree(tree: BookmarkNode[], markDirty = true) {
    store.setBookmarksTree(tree, markDirty)
  }

  function addBookmarkForPage(pageId: string, title?: string) {
    store.addBookmarkForPage(pageId, title)
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
    exportDocument,
    exportJob,
    getSuggestedFilename,
    getEstimatedSize,
    clearExportError,
    parsePageRange,
    validatePageRange,

    // Page Actions
    handlePagePreview,
    handleClosePreview,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRotateSelected,
    handleDiffSelected,

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

    // History (Command Manager)
    undo,
    redo,
    canUndo,
    canRedo,
    undoName,
    redoName,
    historyList,
    jumpTo,

    // Undoable structure changes
    handleReorderPages,
    handleSplitGroup,

    // Selection + UI State
    selectPage,
    togglePageSelection,
    selectRange,
    selectAllPages,
    clearSelection,
    enterMobileSelectionMode,
    exitMobileSelectionMode,

    // Project / Metadata / Security
    setProjectTitleDraft,
    commitProjectTitle,
    setCurrentTool,
    handleRestoreSession,
    setMetadata,
    applyMetadataFromSource,
    addKeyword,
    removeKeyword,
    setSecurity,
    setBookmarksTree,
    addBookmarkForPage,
  }
}

// Export type for use in layouts
export type AppActions = ReturnType<typeof useAppActions>
