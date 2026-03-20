import { describe, expect, it, vi } from 'vitest'
import {
  createProjectCatalogService,
  resolveProjectCatalogDefaults,
} from '@/domains/project-session/application/project-catalog.service'
import type { ProjectMeta } from '@/shared/infrastructure/db'

function createProjectMeta(partial: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    id: partial.id ?? crypto.randomUUID(),
    title: partial.title ?? 'Project',
    pageCount: partial.pageCount ?? 0,
    updatedAt: partial.updatedAt ?? Date.now(),
    createdAt: partial.createdAt ?? Date.now(),
    trashedAt: partial.trashedAt ?? null,
    thumbnail: partial.thumbnail,
    thumbnailKey: partial.thumbnailKey,
  }
}

function createPersistenceStub() {
  return {
    listRecentProjects: vi.fn(async () => []),
    listTrashedProjects: vi.fn(async () => []),
    loadProjectMeta: vi.fn(async () => undefined),
    renameProject: vi.fn(async () => null),
    duplicateProject: vi.fn(async () => null),
    trashProject: vi.fn(async () => null),
    restoreProject: vi.fn(async () => null),
    permanentlyDeleteProject: vi.fn(async () => {}),
    emptyTrash: vi.fn(async () => []),
  }
}

describe('project-catalog.service', () => {
  it('resolves shared authoring defaults from preferences', () => {
    expect(
      resolveProjectCatalogDefaults({
        defaultAuthor: 'Alice',
        defaultGridZoom: 999,
      }),
    ).toEqual({
      defaultAuthor: 'Alice',
      defaultGridZoom: 320,
    })
  })

  it('creates projects through one shared authoring path', async () => {
    const persistence = createPersistenceStub()
    const createProject = vi.fn(async () => createProjectMeta({ id: 'project-1', title: 'New Project' }))
    const service = createProjectCatalogService({
      persistence: persistence as never,
      authoring: {
        createProject,
      } as never,
      getDefaults: () =>
        resolveProjectCatalogDefaults({
          defaultAuthor: '  Alice  ',
          defaultGridZoom: 999,
        }),
    })

    const meta = await service.createProject({ title: 'New Project' })

    expect(meta.id).toBe('project-1')
    expect(createProject).toHaveBeenCalledWith({
      title: 'New Project',
      defaultAuthor: '  Alice  ',
      defaultGridZoom: 320,
    })
  })

  it('converts persistence empty-trash ids into a catalog count', async () => {
    const persistence = createPersistenceStub()
    persistence.emptyTrash.mockResolvedValue(['p1', 'p2', 'p3'])
    const service = createProjectCatalogService({
      persistence: persistence as never,
    })

    await expect(service.emptyTrash()).resolves.toBe(3)
  })
})
