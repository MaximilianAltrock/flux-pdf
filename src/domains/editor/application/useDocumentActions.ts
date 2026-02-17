import { storeToRefs } from 'pinia'
import { inject, provide, type InjectionKey } from 'vue'
import { useEditorCompositionRoot } from '@/app/composition-root'
import { useRouter } from 'vue-router'
import { DEFAULT_PROJECT_TITLE } from '@/shared/constants'
import { useToast } from '@/shared/composables/useToast'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useMobile } from '@/shared/composables/useMobile'
import { useActiveElementBlur } from '@/shared/composables/useActiveElementBlur'
import { useSourceDropHandlers } from '@/domains/document/application/composables/useSourceDropHandlers'
import { createCommandActions } from '@/domains/editor/application/actions/command-actions'
import { createFileExportActions } from '@/domains/editor/application/actions/file-export-actions'
import { createMetadataActions } from '@/domains/editor/application/actions/metadata-actions'
import { createPageActions } from '@/domains/editor/application/actions/page-actions'
import { createOutlineActions } from '@/domains/editor/application/actions/outline-actions'
import { createProjectActions } from '@/domains/editor/application/actions/project-actions'
import { useFileInput } from '@/shared/composables/useFileInput'
import type { DocumentUiState } from '@/shared/types/ui'

/**
 * Centralized action handlers for the application
 * All business logic lives here, keeping components thin
 */
export function useDocumentActions() {
  const root = useEditorCompositionRoot()
  const store = root.stores.documentStore
  const history = root.stores.historyStore
  const ui = root.stores.uiStore
  const exportState = root.stores.exportStore
  const projects = root.stores.projectsStore
  const { zoom, ignoredPreflightRuleIds } = root.refs
  const { exportJob: exportStateJob, activeProjectId, activeProjectMeta } = root.refs
  const { openFileDialog, clearFileInput } = useFileInput()
  const { undo, redo, jumpTo, clearHistory } = history
  const { canUndo, canRedo, undoName, redoName, historyList } = storeToRefs(history)
  const toast = useToast()
  const { confirmDelete, confirm } = useConfirm()
  const { isMobile, haptic, shareFile, canShareFiles } = useMobile()
  const { blurActiveElement } = useActiveElementBlur()
  const router = useRouter()
  const uiState: DocumentUiState = {
    zoom,
    setZoom: ui.setZoom,
    setLoading: ui.setLoading,
    ignoredPreflightRuleIds,
    setIgnoredPreflightRuleIds: ui.setIgnoredPreflightRuleIds,
  }
  projects.bindUiState(uiState)
  const {
    importFiles,
    generateRawPdf,
    exportDocument: exportDocumentService,
    getSuggestedFilename,
    getEstimatedSize,
    clearExportError,
    parsePageRange,
    validatePageRange,
  } = root.services.documentService
  const exportJob = exportStateJob
  const { handleSourceDropped, handleSourcePageDropped, handleSourcePagesDropped } =
    useSourceDropHandlers({
      store,
      history,
    })
  const {
    updateOutlineTree,
    addOutlineNodeForPage,
    renameOutlineNode,
    setOutlineNodeTarget,
    setOutlineNodeUrl,
    clearOutlineNodeTarget,
    updateOutlineNodeStyle,
    deleteOutlineNode,
    deleteOutlineBranch,
    toggleOutlineExpanded,
    resetOutlineToFileStructure,
    cleanBrokenOutlineNodes,
    beginOutlineTargeting,
    completeOutlineTargeting,
  } = createOutlineActions({
    store,
    history,
    ui,
    toast,
  })
  const {
    handleFileInputChange,
    handleFilesSelected,
    handleSourcesSelected,
    exportDocument,
    handleExport,
    handleExportSelected,
    handleExportSuccess,
    openExportOptions,
    handleMobileAddFiles,
    handleMobileTakePhoto,
  } = createFileExportActions({
    store,
    ui,
    exportState,
    toast,
    mobile: { isMobile, canShareFiles, haptic, shareFile },
    openFileDialog,
    clearFileInput,
    blurActiveElement,
    services: {
      importFiles,
      generateRawPdf,
      exportDocument: exportDocumentService,
      parsePageRange,
    },
  })
  const {
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
  } = createPageActions({
    store,
    history,
    ui,
    toast,
    isMobile,
    haptic,
    confirmDelete,
  })

  function normalizeProjectTitle(value: string) {
    let next = value.trim()
    if (!next) next = DEFAULT_PROJECT_TITLE
    return next.replace(/[/\\:]/g, '-')
  }
  const {
    setProjectTitleDraft,
    commitProjectTitle,
    setCurrentTool,
    setMetadata,
    applyMetadataFromSource,
    addKeyword,
    removeKeyword,
    setSecurity,
  } = createMetadataActions({
    store,
    ui,
    normalizeProjectTitle,
  })
  const {
    handleClearProject,
    handleDeleteProject,
    handleNewProject,
  } = createProjectActions({
    store,
    ui,
    exportState,
    projects,
    router,
    toast,
    confirm,
    clearHistory,
    activeProjectId,
    activeProjectMeta,
    normalizeProjectTitle,
  })
  const { handleContextAction, handleCommandAction } = createCommandActions({
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
  })

  // ============================================
  // Project Management
  // ============================================

  // ============================================
  // Zoom Actions
  // ============================================

  function zoomIn() {
    ui.zoomIn()
  }

  function zoomOut() {
    ui.zoomOut()
  }

  return {
    // File Handling
    handleFileInputChange,
    handleFilesSelected,
    handleSourcesSelected,
    handleSourceDropped,
    handleSourcePageDropped,
    handleSourcePagesDropped,

    // Export
    handleExport,
    handleExportSelected,
    handleExportSuccess,
    openExportOptions,
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
    applyPreflightFix,
    addRedaction,
    updateRedaction,
    deleteRedaction,
    deleteRedactions,

    // Source Management
    handleRemoveSource,

    // Project Management
    handleClearProject,
    handleDeleteProject,
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
    clearSelectionKeepMode,
    enterMobileSelectionMode,
    exitMobileSelectionMode,
    enterMobileMoveMode,
    exitMobileMoveMode,
    enterMobileSplitMode,
    exitMobileSplitMode,
    handleMoveSelectedToPosition,

    // Project / Metadata / Security
    setProjectTitleDraft,
    commitProjectTitle,
    setCurrentTool,
    setMetadata,
    applyMetadataFromSource,
    addKeyword,
    removeKeyword,
    setSecurity,
    updateOutlineTree,
    addOutlineNodeForPage,
    renameOutlineNode,
    setOutlineNodeTarget,
    setOutlineNodeUrl,
    clearOutlineNodeTarget,
    updateOutlineNodeStyle,
    deleteOutlineNode,
    deleteOutlineBranch,
    toggleOutlineExpanded,
    resetOutlineToFileStructure,
    cleanBrokenOutlineNodes,
    beginOutlineTargeting,
    completeOutlineTargeting,
  }
}

export type DocumentActions = ReturnType<typeof useDocumentActions>

const documentActionsKey: InjectionKey<DocumentActions> = Symbol('document-actions')

export function provideDocumentActions(actions: DocumentActions) {
  provide(documentActionsKey, actions)
}

export function useDocumentActionsContext(): DocumentActions {
  const actions = inject(documentActionsKey)
  if (!actions) {
    throw new Error('useDocumentActionsContext must be used within EditorView provider')
  }
  return actions
}


