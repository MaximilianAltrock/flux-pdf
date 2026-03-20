import type { ProjectMeta, ProjectState } from '@/shared/infrastructure/db'
import {
  getFirstContentPage,
  isProjectTrashed,
} from '@/domains/project-session/domain/project-snapshot'
import type { GcStateSnapshot } from '@/domains/project-session/domain/project-storage-gc'
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
  hydrateStore(
    meta: ProjectMeta,
    state: ProjectState,
    isCurrent: () => boolean,
  ): Promise<boolean>
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
  let latestLoadToken = 0

  async function loadProject(id: string): Promise<boolean> {
    if (!id) return false

    const loadToken = ++latestLoadToken
    const isCurrent = () => loadToken === latestLoadToken

    options.setHydrating(true)
    options.setLoading(true, 'Loading project...')

    try {
      const { meta, state } = await options.persistence.loadProjectBundle(id)
      if (!meta || !state) return false
      if (!isCurrent()) return false

      if (isProjectTrashed(meta)) {
        if (options.state.getLastActiveProjectId() === id) {
          options.state.setLastActiveProjectId(null)
        }
        return false
      }

      const hydrated = await options.hydrateStore(meta, state, isCurrent)
      if (!hydrated || !isCurrent()) return false
      options.state.setActiveProject(id, meta)
      options.state.setLastActiveProjectId(id)
      if (!isCurrent()) return false

      const firstPage = getFirstContentPage(state.pageMap as PageReference[])
      options.rememberThumbnailKey(id, firstPage)
      void options.runGarbageCollection(options.getLiveGcState())
      return true
    } catch (error) {
      options.onLoadError?.(error)
      return false
    } finally {
      if (isCurrent()) {
        options.setHydrating(false)
        options.setLoading(false)
      }
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
    await options.runGarbageCollection(options.getLiveGcState())
  }

  async function trashProject(id: string): Promise<void> {
    if (options.state.getActiveProjectId() === id) {
      await options.persistActiveProject()
    }
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

    await options.runGarbageCollection(options.getLiveGcState())
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
