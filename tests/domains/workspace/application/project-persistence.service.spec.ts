import { describe, expect, it } from 'vitest'
import type { ProjectMeta, ProjectState, StoredFile } from '@/shared/infrastructure/db'
import {
  createProjectPersistenceService,
  type ProjectPersistenceRepository,
} from '@/domains/workspace/application/project-persistence.service'

function createMeta(partial: Partial<ProjectMeta>): ProjectMeta {
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

function createState(partial: Partial<ProjectState>): ProjectState {
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

function createStoredFile(id: string): StoredFile {
  return {
    id,
    data: new Uint8Array([1, 2, 3]).buffer,
    filename: `${id}.pdf`,
    fileSize: 3,
    pageCount: 1,
    addedAt: Date.now(),
    color: 'blue',
    pageMetaData: [],
  }
}

function createRepository(
  seedMeta: ProjectMeta[] = [],
  seedState: ProjectState[] = [],
  seedFiles: StoredFile[] = [],
): ProjectPersistenceRepository {
  const metas = new Map(seedMeta.map((meta) => [meta.id, meta]))
  const states = new Map(seedState.map((state) => [state.id, state]))
  const files = new Map(seedFiles.map((file) => [file.id, file]))

  return {
    listProjectsByUpdatedAtDesc: async () =>
      Array.from(metas.values()).sort((a, b) => b.updatedAt - a.updatedAt),
    listAllProjects: async () => Array.from(metas.values()),
    listProjectStates: async () => Array.from(states.values()),
    listStoredFileKeys: async () => Array.from(files.keys()),
    getStoredFilesByIds: async (ids) => ids.map((id) => files.get(id)).filter((f): f is StoredFile => Boolean(f)),
    getProjectMeta: async (id) => metas.get(id),
    getProjectState: async (id) => states.get(id),
    putProjectMeta: async (meta) => {
      metas.set(meta.id, meta)
    },
    putProjectState: async (state) => {
      states.set(state.id, state)
    },
    deleteStoredFilesByIds: async (ids) => {
      for (const id of ids) files.delete(id)
    },
    deleteProjectMeta: async (id) => {
      metas.delete(id)
    },
    deleteProjectState: async (id) => {
      states.delete(id)
    },
    deleteProjectsAndStates: async (ids) => {
      for (const id of ids) {
        metas.delete(id)
        states.delete(id)
      }
    },
  }
}

describe('project-persistence.service', () => {
  it('lists recent and trashed projects with filtering and limits', async () => {
    const repository = createRepository([
      createMeta({ id: 'a', updatedAt: 1 }),
      createMeta({ id: 'b', updatedAt: 3, trashedAt: 100 }),
      createMeta({ id: 'c', updatedAt: 2 }),
      createMeta({ id: 'd', updatedAt: 4, trashedAt: 200 }),
    ])
    const service = createProjectPersistenceService(repository)

    const recent = await service.listRecentProjects(2)
    const trashed = await service.listTrashedProjects()

    expect(recent.map((project) => project.id)).toEqual(['c', 'a'])
    expect(trashed.map((project) => project.id)).toEqual(['d', 'b'])
  })

  it('saves and loads project bundle', async () => {
    const repository = createRepository()
    const service = createProjectPersistenceService(repository)
    const meta = createMeta({ id: 'p1', title: 'P1' })
    const state = createState({ id: 'p1', historyPointer: 2 })

    await service.saveProjectRecord(meta, state)

    const bundle = await service.loadProjectBundle('p1')
    expect(bundle.meta?.id).toBe('p1')
    expect(bundle.state?.historyPointer).toBe(2)
  })

  it('lists states and stored files via repository wrappers', async () => {
    const repository = createRepository(
      [createMeta({ id: 'p1' })],
      [createState({ id: 'p1' })],
      [createStoredFile('f1'), createStoredFile('f2')],
    )
    const service = createProjectPersistenceService(repository)

    const states = await service.listProjectStates()
    const keys = await service.listStoredFileKeys()
    const files = await service.loadStoredFiles(['f2', 'missing'])
    await service.deleteStoredFiles(['f1'])
    const keysAfterDelete = await service.listStoredFileKeys()

    expect(states).toHaveLength(1)
    expect(keys).toEqual(['f1', 'f2'])
    expect(files.map((file) => file.id)).toEqual(['f2'])
    expect(keysAfterDelete).toEqual(['f2'])
  })

  it('renames, duplicates, and deletes projects', async () => {
    const meta = createMeta({ id: 'p1', title: 'Original', updatedAt: 10, createdAt: 10 })
    const state = createState({ id: 'p1', updatedAt: 10 })
    const repository = createRepository([meta], [state])
    const service = createProjectPersistenceService(repository)

    const renamed = await service.renameProject('p1', '   ')
    expect(renamed?.title).toBe('Untitled Project')

    const duplicate = await service.duplicateProject('p1')
    expect(duplicate).not.toBeNull()
    expect(duplicate?.id).not.toBe('p1')
    expect(duplicate?.title.endsWith('Copy')).toBe(true)
    const duplicateBundle = await service.loadProjectBundle(duplicate!.id)
    expect(duplicateBundle.state?.id).toBe(duplicate?.id)

    await service.permanentlyDeleteProject('p1')
    const original = await service.loadProjectBundle('p1')
    expect(original.meta).toBeUndefined()
    expect(original.state).toBeUndefined()
  })

  it('trashes, restores, and empties trash', async () => {
    const activeMeta = createMeta({ id: 'active', trashedAt: null })
    const oldTrashMeta = createMeta({ id: 'trashed', trashedAt: 50 })
    const repository = createRepository(
      [activeMeta, oldTrashMeta],
      [createState({ id: 'active' }), createState({ id: 'trashed' })],
    )
    const service = createProjectPersistenceService(repository)

    const trashed = await service.trashProject('active')
    expect(trashed?.trashedAt).toBeTypeOf('number')

    const restored = await service.restoreProject('trashed')
    expect(restored?.trashedAt).toBeNull()

    const removedIds = await service.emptyTrash()
    expect(removedIds).toEqual(['active'])
    const bundle = await service.loadProjectBundle('active')
    expect(bundle.meta).toBeUndefined()
    expect(bundle.state).toBeUndefined()
  })
})
