import { describe, expect, it, vi } from 'vitest'
import type { ProjectMeta, ProjectState } from '@/shared/infrastructure/db'
import {
  createProjectLifecycleService,
  type ProjectLifecycleStateController,
} from '@/domains/workspace/application/project-lifecycle.service'
import type { GcStateSnapshot } from '@/domains/workspace/application/project-storage-gc'

function createProjectMeta(partial: Partial<ProjectMeta>): ProjectMeta {
  return {
    id: partial.id ?? crypto.randomUUID(),
    title: partial.title ?? 'Project',
    pageCount: partial.pageCount ?? 0,
    updatedAt: partial.updatedAt ?? Date.now(),
    createdAt: partial.createdAt ?? Date.now(),
    trashedAt: partial.trashedAt,
    thumbnail: partial.thumbnail,
  }
}

function createProjectState(partial: Partial<ProjectState>): ProjectState {
  return {
    id: partial.id ?? crypto.randomUUID(),
    activeSourceIds: partial.activeSourceIds ?? [],
    pageMap: partial.pageMap ?? [],
    history: partial.history ?? [],
    historyPointer: partial.historyPointer ?? -1,
    zoom: partial.zoom ?? 220,
    updatedAt: partial.updatedAt ?? Date.now(),
    outlineTree: partial.outlineTree,
    outlineDirty: partial.outlineDirty,
    metadata: partial.metadata,
    security: partial.security,
    metadataDirty: partial.metadataDirty,
    ignoredPreflightRuleIds: partial.ignoredPreflightRuleIds,
  }
}

function createStateController(state: {
  activeProjectId: string | null
  activeProjectMeta: ProjectMeta | null
  lastActiveProjectId: string | null
}): ProjectLifecycleStateController {
  return {
    getActiveProjectId: () => state.activeProjectId,
    getActiveProjectMeta: () => state.activeProjectMeta,
    getLastActiveProjectId: () => state.lastActiveProjectId,
    setActiveProject: (id, meta) => {
      state.activeProjectId = id
      state.activeProjectMeta = meta
    },
    setLastActiveProjectId: (id) => {
      state.lastActiveProjectId = id
    },
  }
}

describe('project-lifecycle.service', () => {
  it('loads project bundle and updates active state', async () => {
    const state = {
      activeProjectId: null,
      activeProjectMeta: null as ProjectMeta | null,
      lastActiveProjectId: 'old',
    }
    const meta = createProjectMeta({ id: 'p1' })
    const projectState = createProjectState({
      id: 'p1',
      pageMap: [{ id: 'page-1', sourceFileId: 's1', sourcePageIndex: 0, rotation: 0 }],
    })
    const hydrateStore = vi.fn(async () => {})
    const rememberThumbnailKey = vi.fn()
    const runGarbageCollection = vi.fn(async (_state?: GcStateSnapshot) => {})
    const setHydrating = vi.fn()
    const setLoading = vi.fn()

    const service = createProjectLifecycleService({
      persistence: {
        loadProjectBundle: async () => ({ meta, state: projectState }),
        permanentlyDeleteProject: async () => {},
        trashProject: async () => null,
        restoreProject: async () => null,
        emptyTrash: async () => [],
      },
      state: createStateController(state),
      hydrateStore,
      persistActiveProject: vi.fn(async () => {}),
      rememberThumbnailKey,
      getLiveGcState: () => ({ activeSourceIds: [], pages: [], history: [] }),
      runGarbageCollection,
      setHydrating,
      setLoading,
      onLoadError: vi.fn(),
    })

    const loaded = await service.loadProject('p1')

    expect(loaded).toBe(true)
    expect(hydrateStore).toHaveBeenCalledWith(meta, projectState)
    expect(state.activeProjectId).toBe('p1')
    expect(state.activeProjectMeta).toEqual(meta)
    expect(state.lastActiveProjectId).toBe('p1')
    expect(rememberThumbnailKey).toHaveBeenCalledWith('p1', projectState.pageMap[0])
    expect(runGarbageCollection).toHaveBeenCalled()
    expect(setHydrating).toHaveBeenNthCalledWith(1, true)
    expect(setHydrating).toHaveBeenLastCalledWith(false)
    expect(setLoading).toHaveBeenNthCalledWith(1, true, 'Loading project...')
    expect(setLoading).toHaveBeenLastCalledWith(false)
  })

  it('clears last active id when trying to load a trashed project', async () => {
    const state = {
      activeProjectId: null,
      activeProjectMeta: null as ProjectMeta | null,
      lastActiveProjectId: 'trash-id',
    }
    const service = createProjectLifecycleService({
      persistence: {
        loadProjectBundle: async () => ({
          meta: createProjectMeta({ id: 'trash-id', trashedAt: Date.now() }),
          state: createProjectState({ id: 'trash-id' }),
        }),
        permanentlyDeleteProject: async () => {},
        trashProject: async () => null,
        restoreProject: async () => null,
        emptyTrash: async () => [],
      },
      state: createStateController(state),
      hydrateStore: vi.fn(async () => {}),
      persistActiveProject: vi.fn(async () => {}),
      rememberThumbnailKey: vi.fn(),
      getLiveGcState: () => ({ activeSourceIds: [], pages: [], history: [] }),
      runGarbageCollection: vi.fn(async () => {}),
      setHydrating: vi.fn(),
      setLoading: vi.fn(),
    })

    const loaded = await service.loadProject('trash-id')

    expect(loaded).toBe(false)
    expect(state.lastActiveProjectId).toBeNull()
  })

  it('switches projects and saves current one before loading the next', async () => {
    const state = {
      activeProjectId: 'old',
      activeProjectMeta: createProjectMeta({ id: 'old' }),
      lastActiveProjectId: 'old',
    }
    const persistActiveProject = vi.fn(async () => {})
    const loadProjectBundle = vi.fn(async () => ({
      meta: createProjectMeta({ id: 'new' }),
      state: createProjectState({ id: 'new' }),
    }))
    const service = createProjectLifecycleService({
      persistence: {
        loadProjectBundle,
        permanentlyDeleteProject: async () => {},
        trashProject: async () => null,
        restoreProject: async () => null,
        emptyTrash: async () => [],
      },
      state: createStateController(state),
      hydrateStore: vi.fn(async () => {}),
      persistActiveProject,
      rememberThumbnailKey: vi.fn(),
      getLiveGcState: () => ({ activeSourceIds: [], pages: [], history: [] }),
      runGarbageCollection: vi.fn(async () => {}),
      setHydrating: vi.fn(),
      setLoading: vi.fn(),
    })

    const switched = await service.switchProject('new')

    expect(switched).toBe(true)
    expect(persistActiveProject).toHaveBeenCalledOnce()
    expect(loadProjectBundle).toHaveBeenCalledWith('new')
  })

  it('clears active/last state for trash, delete, and emptyTrash flows', async () => {
    const state = {
      activeProjectId: 'p1',
      activeProjectMeta: createProjectMeta({ id: 'p1' }),
      lastActiveProjectId: 'p1',
    }
    const runGarbageCollection = vi.fn(async () => {})
    const service = createProjectLifecycleService({
      persistence: {
        loadProjectBundle: async () => ({ meta: undefined, state: undefined }),
        permanentlyDeleteProject: async () => {},
        trashProject: async () => createProjectMeta({ id: 'p1', trashedAt: Date.now() }),
        restoreProject: async () => createProjectMeta({ id: 'p1', trashedAt: null }),
        emptyTrash: async () => ['p1'],
      },
      state: createStateController(state),
      hydrateStore: vi.fn(async () => {}),
      persistActiveProject: vi.fn(async () => {}),
      rememberThumbnailKey: vi.fn(),
      getLiveGcState: () => ({ activeSourceIds: [], pages: [], history: [] }),
      runGarbageCollection,
      setHydrating: vi.fn(),
      setLoading: vi.fn(),
    })

    await service.trashProject('p1')
    expect(state.activeProjectId).toBeNull()
    expect(state.lastActiveProjectId).toBeNull()

    state.activeProjectId = 'p1'
    state.activeProjectMeta = createProjectMeta({ id: 'p1' })
    state.lastActiveProjectId = 'p1'
    await service.permanentlyDeleteProject('p1')
    expect(state.activeProjectId).toBeNull()
    expect(state.lastActiveProjectId).toBeNull()

    state.activeProjectId = 'p1'
    state.activeProjectMeta = createProjectMeta({ id: 'p1' })
    state.lastActiveProjectId = 'p1'
    const emptied = await service.emptyTrash()
    expect(emptied).toBe(1)
    expect(state.activeProjectId).toBeNull()
    expect(state.lastActiveProjectId).toBeNull()
    expect(runGarbageCollection).toHaveBeenCalledTimes(2)
  })
})
