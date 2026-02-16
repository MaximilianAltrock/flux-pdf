import type { Ref } from 'vue'
import { DEFAULT_PROJECT_TITLE } from '@/shared/constants'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { useExportStore } from '@/domains/export/store/export.store'
import type { useProjectsStore } from '@/domains/workspace/store/projects.store'
import type { Router } from 'vue-router'

interface ProjectActionsToast {
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

export interface CreateProjectActionsDeps {
  store: ReturnType<typeof useDocumentStore>
  ui: Pick<
    ReturnType<typeof useUiStore>,
    'closeCommandPalette' | 'closePreflightPanel' | 'closePreviewModal' | 'closeDiffModal'
  >
  exportState: Pick<ReturnType<typeof useExportStore>, 'closeExportModal'>
  projects: Pick<
    ReturnType<typeof useProjectsStore>,
    'persistActiveProject' | 'trashProject' | 'createProject'
  >
  router: Pick<Router, 'push'>
  toast: ProjectActionsToast
  confirm: ProjectConfirm
  clearHistory: () => void
  activeProjectId: Ref<string | null | undefined>
  activeProjectMeta: Ref<{ title?: string } | null | undefined>
  normalizeProjectTitle: (value: string) => string
}

export function createProjectActions({
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
}: CreateProjectActionsDeps) {
  function resetWorkspaceUi() {
    ui.closeCommandPalette()
    ui.closePreflightPanel()
    exportState.closeExportModal()
    ui.closePreviewModal()
    ui.closeDiffModal()
  }

  async function handleClearProject() {
    const confirmed = await confirm({
      title: 'Clear project?',
      message: 'This will remove all files, metadata, and history from this project.',
      confirmText: 'Clear Project',
      variant: 'danger',
    })
    if (!confirmed) return

    resetWorkspaceUi()
    store.reset()
    clearHistory()

    toast.success('Project cleared')

    try {
      await projects.persistActiveProject()
    } catch (error) {
      console.error('Failed to persist cleared project:', error)
      toast.error('Failed to save cleared project')
    }
  }

  async function handleDeleteProject() {
    const projectId = activeProjectId.value
    if (!projectId) {
      toast.error('No active project to delete')
      return
    }

    const projectTitle = normalizeProjectTitle(activeProjectMeta.value?.title ?? store.projectTitle)

    const confirmed = await confirm({
      title: `Move "${projectTitle}" to trash?`,
      message: 'You can restore this project later from the Trash view.',
      confirmText: 'Move to Trash',
      variant: 'warning',
    })
    if (!confirmed) return

    await projects.trashProject(projectId)
    toast.success('Project moved to trash')
    await router.push('/')
  }

  async function handleNewProject() {
    const confirmed = await confirm({
      title: 'Start a new project?',
      message: 'Your current project will be saved automatically before switching.',
      confirmText: 'Create Project',
      variant: 'info',
    })
    if (!confirmed) return
    const project = await projects.createProject({ title: DEFAULT_PROJECT_TITLE })
    toast.success('New project created')
    await router.push(`/project/${project.id}`)
  }

  return {
    handleClearProject,
    handleDeleteProject,
    handleNewProject,
  }
}
