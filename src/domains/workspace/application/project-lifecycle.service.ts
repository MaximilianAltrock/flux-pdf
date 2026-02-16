import type { ProjectMeta, ProjectState } from '@/shared/infrastructure/db'
import { getFirstContentPage, isProjectTrashed } from '@/domains/workspace/application/project-session.service'
import type { GcStateSnapshot } from '@/domains/workspace/application/project-storage-gc'
import type { PageReference } from '@/shared/types'

export interface ProjectLifecyclePersistence {
  loadProjectBundle(id: string): Promise<{ meta: ProjectMeta | undefined; state: ProjectState | undefined }>
  permanentlyDeleteProject(id: string): Promise<void>
  trashProject(id: string): Promise<ProjectMeta | null>
  restoreProject(id: string): Promise<ProjectMeta | null>
  emptyTrash(): Promise<string[]>
}

export interface ProjectLifecycleStateController {
  getActiveProjectId(): string | null
  getActiveProjectMeta(): ProjectMeta | null
  getLastActiveProjectId(): string | null
  setActiveProject(id: string | null, meta: ProjectMeta | null): void
  setLastActiveProjectId(id: string | null): void
}

export interface ProjectLifecycleServiceOptions {
  persistence: ProjectLifecyclePersistence
  state: ProjectLifecycleStateController
  hydrateStore(meta: ProjectMeta, state: ProjectState): Promise<void>
  persistActiveProject(): Promise<void>
  rememberThumbnailKey(projectId: string, page: PageReference | null): void
  getLiveGcState(): GcStateSnapshot
  runGarbageCollection(state?: GcStateSnapshot): Promise<void>
  setHydrating(value: boolean): void
  setLoading(loading: boolean, message?: string): void
  onLoadError?(error: unknown): void
}

export interface ProjectLifecycleService {
  loadProject(id: string): Promise<boolean>
  switchProject(id: string): Promise<boolean>
  permanentlyDeleteProject(id: string): Promise<void>
  trashProject(id: string): Promise<void>
  restoreProject(id: string): Promise<void>
  emptyTrash(): Promise<number>
}

function clearProjectStateForId(
  state: ProjectLifecycleStateController,
  id: string,
  options?: { activeOnly?: boolean },
): void {
  if (state.getActiveProjectId() === id) {
    state.setActiveProject(null, null)
    state.setLastActiveProjectId(null)
  }

  if (!options?.activeOnly && state.getLastActiveProjectId() === id) {
    state.setLastActiveProjectId(null)
  }
}

export function createProjectLifecycleService(
  options: ProjectLifecycleServiceOptions,
): ProjectLifecycleService {
  async function loadProject(id: string): Promise<boolean> {
    if (!id) return false

    options.setHydrating(true)
    options.setLoading(true, 'Loading project...')

    try {
      const { meta, state } = await options.persistence.loadProjectBundle(id)
      if (!meta || !state) return false

      if (isProjectTrashed(meta)) {
        if (options.state.getLastActiveProjectId() === id) {
          options.state.setLastActiveProjectId(null)
        }
        return false
      }

      await options.hydrateStore(meta, state)
      options.state.setActiveProject(id, meta)
      options.state.setLastActiveProjectId(id)

      const firstPage = getFirstContentPage(state.pageMap as PageReference[])
      options.rememberThumbnailKey(id, firstPage)
      void options.runGarbageCollection(options.getLiveGcState())
      return true
    } catch (error) {
      options.onLoadError?.(error)
      return false
    } finally {
      options.setHydrating(false)
      options.setLoading(false)
    }
  }

  async function switchProject(id: string): Promise<boolean> {
    if (!id) return false

    const activeProjectId = options.state.getActiveProjectId()
    const activeProjectMeta = options.state.getActiveProjectMeta()

    if (activeProjectId && activeProjectId !== id) {
      await options.persistActiveProject()
    }

    if (activeProjectId === id && activeProjectMeta) {
      return true
    }

    return loadProject(id)
  }

  async function permanentlyDeleteProject(id: string): Promise<void> {
    await options.persistence.permanentlyDeleteProject(id)
    clearProjectStateForId(options.state, id)
    await options.runGarbageCollection()
  }

  async function trashProject(id: string): Promise<void> {
    const updated = await options.persistence.trashProject(id)
    if (!updated) return
    clearProjectStateForId(options.state, id)
  }

  async function restoreProject(id: string): Promise<void> {
    const updated = await options.persistence.restoreProject(id)
    if (!updated) return

    if (options.state.getActiveProjectId() === id) {
      options.state.setActiveProject(id, updated)
    }
  }

  async function emptyTrash(): Promise<number> {
    const ids = await options.persistence.emptyTrash()
    if (ids.length === 0) return 0

    const activeId = options.state.getActiveProjectId()
    if (activeId && ids.includes(activeId)) {
      clearProjectStateForId(options.state, activeId, { activeOnly: true })
    }

    const lastActiveId = options.state.getLastActiveProjectId()
    if (lastActiveId && ids.includes(lastActiveId)) {
      options.state.setLastActiveProjectId(null)
    }

    await options.runGarbageCollection()
    return ids.length
  }

  return {
    loadProject,
    switchProject,
    permanentlyDeleteProject,
    trashProject,
    restoreProject,
    emptyTrash,
  }
}
