import { computed, inject, onScopeDispose, provide, toRef, type InjectionKey } from 'vue'
import { useRouter } from 'vue-router'
import { DEFAULT_PROJECT_TITLE } from '@/shared/constants'
import { useToast } from '@/shared/composables/useToast'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useMobile } from '@/shared/composables/useMobile'
import { useActiveElementBlur } from '@/shared/composables/useActiveElementBlur'
import { createDocumentImportService } from '@/domains/import/application/document-import.service'
import { createDocumentExportService } from '@/domains/export/application/document-export.service'
import { usePdfRepository } from '@/shared/infrastructure/pdf.repository'
import { useFileInput } from '@/shared/composables/useFileInput'
import { useSettingsPreferencesState } from '@/domains/settings/application'
import { useProjectSession } from '@/domains/project-session/session'
import type { ProjectSession } from '@/domains/project-session/domain/project-session'
import { createFileImportActions } from '@/domains/editor/application/actions/file-import-actions'
import { createProjectActions } from '@/domains/editor/application/actions/project-actions'
import { useExportActionGroup } from '@/domains/editor/application/action-groups/useExportActionGroup'
import { useDocumentActionGroup } from '@/domains/editor/application/action-groups/useDocumentActionGroup'
import { useEditorShellActionGroup } from '@/domains/editor/application/action-groups/useEditorShellActionGroup'

/**
 * Thin editor action assembly.
 *
 * Bounded action groups own their own orchestration; this file only composes the
 * groups into the flat action context consumed by existing editor UI components.
 */
export function useDocumentActions(sessionOverride?: ProjectSession) {
  const session = sessionOverride ?? useProjectSession()
  const store = session.document
  const ui = session.editor
  const exportState = session.exportOperation
  const projects = session.project
  const activeProjectId = toRef(projects, 'activeProjectId')
  const activeProjectMeta = toRef(projects, 'activeProjectMeta')
  const { preferences } = useSettingsPreferencesState()
  const { openFileDialog, clearFileInput } = useFileInput()
  const toast = useToast()
  const { confirmDelete, confirm } = useConfirm()
  const { isMobile, haptic, shareFile, canShareFiles } = useMobile()
  const { blurActiveElement } = useActiveElementBlur()
  const router = useRouter()
  const pdfRepository = usePdfRepository()
  const autoGenerateOutlineSinglePage = computed(
    () => preferences.value.autoGenerateOutlineSinglePage,
  )
  const filenamePattern = computed(() => preferences.value.filenamePattern)
  const importService = createDocumentImportService({
    documentStore: store,
    historyStore: session.history,
    ui: {
      setLoading: ui.setLoading,
      importJob: toRef(session.importOperation, 'importJob'),
    },
    settings: {
      autoGenerateOutlineSinglePage,
    },
  })
  const exportService = createDocumentExportService({
    documentStore: store,
    pdfRepository,
    ui: {
      setLoading: ui.setLoading,
      exportJob: toRef(session.exportOperation, 'exportJob'),
    },
    settings: {
      filenamePattern,
    },
  })
  onScopeDispose(() => {
    exportService.dispose()
  })

  const {
    importFiles,
  } = importService
  const {
    generateRawPdf,
    exportDocument: exportDocumentService,
    getSuggestedFilename,
    getEstimatedSize,
    clearExportError,
    parsePageRange,
    validatePageRange,
  } = exportService

  function normalizeProjectTitle(value: string) {
    let next = value.trim()
    if (!next) next = DEFAULT_PROJECT_TITLE
    return next.replace(/[/\\:]/g, '-')
  }
  const historyActions = {
    undo: session.history.undo,
    redo: session.history.redo,
    clearHistory: session.history.clearHistory,
    jumpTo: session.history.jumpTo,
    canUndo: toRef(session.history, 'canUndo'),
    canRedo: toRef(session.history, 'canRedo'),
    undoName: toRef(session.history, 'undoName'),
    redoName: toRef(session.history, 'redoName'),
    historyList: toRef(session.history, 'historyList'),
  }
  const importActions = createFileImportActions({
    toast,
    openFileDialog,
    clearFileInput,
    services: { importFiles },
  })
  const exportActions = useExportActionGroup({
    store,
    ui,
    exportState,
    toast,
    mobile: { isMobile, canShareFiles, haptic, shareFile },
    blurActiveElement,
    services: {
      generateRawPdf,
      exportDocument: exportDocumentService,
      getSuggestedFilename,
      getEstimatedSize,
      clearExportError,
      parsePageRange,
      validatePageRange,
    },
  })
  const documentActions = useDocumentActionGroup({
    store,
    history: session.history,
    ui,
    toast,
    isMobile,
    haptic,
    confirmDelete,
    normalizeProjectTitle,
  })
  const projectActions = createProjectActions({
    store,
    ui,
    exportState,
    projects,
    router,
    toast,
    confirm,
    clearHistory: historyActions.clearHistory,
    activeProjectId,
    activeProjectMeta,
    normalizeProjectTitle,
  })
  const shellActions = useEditorShellActionGroup({
    store,
    ui,
    openFileDialog,
    handlePagePreview: documentActions.handlePagePreview,
    handleDuplicateSelected: documentActions.handleDuplicateSelected,
    handleRotateSelected: documentActions.handleRotateSelected,
    handleExportSelected: exportActions.handleExportSelected,
    handleDeleteSelected: documentActions.handleDeleteSelected,
    handleDiffSelected: documentActions.handleDiffSelected,
    handleExport: exportActions.handleExport,
    handleNewProject: projectActions.handleNewProject,
  })

  return {
    ...importActions,
    ...exportActions,
    ...documentActions,
    ...projectActions,
    ...historyActions,
    ...shellActions,
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
