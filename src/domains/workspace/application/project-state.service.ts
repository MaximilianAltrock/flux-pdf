import { ref, shallowRef, type Ref } from 'vue'
import type { ProjectMeta } from '@/shared/infrastructure/db'
import type { ProjectLifecycleStateController } from '@/domains/workspace/application/project-lifecycle.service'
import type { DocumentUiState } from '@/shared/types/ui'

export interface ProjectStateController {
  activeProjectId: ReturnType<typeof shallowRef<string | null>>
  activeProjectMeta: ReturnType<typeof ref<ProjectMeta | null>>
  isHydrating: ReturnType<typeof shallowRef<boolean>>
  lastActiveProjectId: Ref<string | null>
  boundUiState: ReturnType<typeof shallowRef<DocumentUiState | null>>
  lifecycleState: ProjectLifecycleStateController
  bindUiState(uiState?: DocumentUiState): void
  setActiveProject(id: string | null, meta: ProjectMeta | null): void
  getLastActiveProjectId(): string | null
  setLastActiveProjectId(id: string | null): void
  setHydrating(value: boolean): void
  setLoading(loading: boolean, message?: string): void
}

export function createProjectStateController(
  lastActiveProjectId: Ref<string | null>,
): ProjectStateController {
  const activeProjectId = shallowRef<string | null>(null)
  const activeProjectMeta = ref<ProjectMeta | null>(null)
  const isHydrating = shallowRef(false)
  const boundUiState = shallowRef<DocumentUiState | null>(null)

  function bindUiState(uiState?: DocumentUiState): void {
    if (uiState) boundUiState.value = uiState
  }

  function setActiveProject(id: string | null, meta: ProjectMeta | null): void {
    activeProjectId.value = id
    activeProjectMeta.value = meta
  }

  function getLastActiveProjectId(): string | null {
    return lastActiveProjectId.value
  }

  function setLastActiveProjectId(id: string | null): void {
    lastActiveProjectId.value = id
  }

  function setHydrating(value: boolean): void {
    isHydrating.value = value
  }

  function setLoading(loading: boolean, message?: string): void {
    boundUiState.value?.setLoading(loading, message)
  }

  const lifecycleState: ProjectLifecycleStateController = {
    getActiveProjectId: () => activeProjectId.value,
    getActiveProjectMeta: () => activeProjectMeta.value,
    getLastActiveProjectId,
    setActiveProject,
    setLastActiveProjectId,
  }

  return {
    activeProjectId,
    activeProjectMeta,
    isHydrating,
    lastActiveProjectId,
    boundUiState,
    lifecycleState,
    bindUiState,
    setActiveProject,
    getLastActiveProjectId,
    setLastActiveProjectId,
    setHydrating,
    setLoading,
  }
}
