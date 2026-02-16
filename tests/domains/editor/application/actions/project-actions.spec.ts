import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createProjectActions } from '@/domains/editor/application/actions/project-actions'
import { DEFAULT_PROJECT_TITLE } from '@/shared/constants'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { useExportStore } from '@/domains/export/store/export.store'
import type { useProjectsStore } from '@/domains/workspace/store/projects.store'

function createHarness() {
  const store = {
    projectTitle: 'Project',
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useDocumentStore>
  const ui = {
    closeCommandPalette: vi.fn(),
    closePreflightPanel: vi.fn(),
    closePreviewModal: vi.fn(),
    closeDiffModal: vi.fn(),
  } as unknown as Pick<
    ReturnType<typeof useUiStore>,
    'closeCommandPalette' | 'closePreflightPanel' | 'closePreviewModal' | 'closeDiffModal'
  >
  const exportState = {
    closeExportModal: vi.fn(),
  } as unknown as Pick<ReturnType<typeof useExportStore>, 'closeExportModal'>
  const projects = {
    persistActiveProject: vi.fn(async () => undefined),
    trashProject: vi.fn(async () => undefined),
    createProject: vi.fn(async () => ({ id: 'project-2' })),
  } as unknown as Pick<
    ReturnType<typeof useProjectsStore>,
    'persistActiveProject' | 'trashProject' | 'createProject'
  >
  const router = {
    push: vi.fn(async () => undefined),
  }
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  }
  const confirm = vi.fn(async () => true)
  const clearHistory = vi.fn()
  const activeProjectId = ref<string | null>('project-1')
  const activeProjectMeta = ref<{ title?: string } | null>({ title: 'Project' })
  const normalizeProjectTitle = vi.fn((value: string) => value)

  const actions = createProjectActions({
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

  return {
    actions,
    store,
    ui,
    exportState,
    projects,
    router,
    toast,
    confirm,
    clearHistory,
    activeProjectId,
  }
}

describe('project action module', () => {
  it('does nothing when clear-project confirmation is rejected', async () => {
    const harness = createHarness()
    harness.confirm.mockResolvedValueOnce(false)

    await harness.actions.handleClearProject()

    expect(harness.store.reset).not.toHaveBeenCalled()
    expect(harness.clearHistory).not.toHaveBeenCalled()
  })

  it('shows an error when deleting without an active project id', async () => {
    const harness = createHarness()
    harness.activeProjectId.value = null

    await harness.actions.handleDeleteProject()

    expect(harness.toast.error).toHaveBeenCalledWith('No active project to delete')
    expect(harness.projects.trashProject).not.toHaveBeenCalled()
  })

  it('creates and navigates to a new project after confirmation', async () => {
    const harness = createHarness()

    await harness.actions.handleNewProject()

    expect(harness.projects.createProject).toHaveBeenCalledWith({ title: DEFAULT_PROJECT_TITLE })
    expect(harness.router.push).toHaveBeenCalledWith('/project/project-2')
  })
})
