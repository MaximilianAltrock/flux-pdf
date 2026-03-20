import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import { createProjectActions } from '@/domains/editor/application/actions/project-actions'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { ExportOperationState } from '@/domains/export/session/export-operation.state'
import type { ProjectSessionLifecycle } from '@/domains/project-session/domain/project-session'

interface ProjectActionToast {
  success: (title: string, detail?: string) => unknown
  error: (title: string, detail?: string) => unknown
}

interface ProjectConfirm {
  (options: {
    title: string
    message: string
    confirmText?: string
    variant?: 'danger' | 'warning' | 'info'
  }): Promise<boolean>
}

export interface UseProjectActionGroupDeps {
  store: DocumentState
  ui: Pick<
    EditorUiState,
    'closeCommandPalette' | 'closePreflightPanel' | 'closePreviewModal' | 'closeDiffModal'
  >
  exportState: Pick<ExportOperationState, 'closeExportModal'>
  projects: Pick<ProjectSessionLifecycle, 'persistActiveProject' | 'trashProject' | 'createProject'>
  router: Pick<Router, 'push'>
  toast: ProjectActionToast
  confirm: ProjectConfirm
  clearHistory: () => void
  activeProjectId: Ref<string | null | undefined>
  activeProjectMeta: Ref<{ title?: string } | null>
  normalizeProjectTitle: (value: string) => string
}

export function useProjectActionGroup(deps: UseProjectActionGroupDeps) {
  return createProjectActions(deps)
}
