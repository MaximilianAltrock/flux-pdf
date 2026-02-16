import { describe, expect, it, vi } from 'vitest'
import type { ProjectMeta } from '@/shared/infrastructure/db'
import {
  createProjectThumbnailService,
  getProjectThumbnailKey,
} from '@/domains/workspace/application/project-thumbnail.service'
import type { PageReference } from '@/shared/types'

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

function createPageReference(partial: Partial<PageReference>): PageReference {
  return {
    id: partial.id ?? crypto.randomUUID(),
    sourceFileId: partial.sourceFileId ?? 'source-1',
    sourcePageIndex: partial.sourcePageIndex ?? 0,
    rotation: partial.rotation ?? 0,
    groupId: partial.groupId,
    targetDimensions: partial.targetDimensions,
    redactions: partial.redactions,
  }
}

describe('project-thumbnail.service', () => {
  it('reuses existing thumbnail when cached key matches', async () => {
    const renderThumbnail = vi.fn(async () => 'blob://thumbnail')
    const fetchBlob = vi.fn(async () => new Blob(['new']))
    const service = createProjectThumbnailService({ renderThumbnail, fetchBlob })
    const page = createPageReference({ sourceFileId: 'source-a', sourcePageIndex: 2, rotation: 90 })
    const cachedBlob = new Blob(['cached'])

    service.rememberThumbnailKey('project-1', page)

    const thumbnail = await service.ensureThumbnail(
      createProjectMeta({ id: 'project-1', thumbnail: cachedBlob }),
      page,
    )

    expect(thumbnail).toBe(cachedBlob)
    expect(renderThumbnail).not.toHaveBeenCalled()
    expect(fetchBlob).not.toHaveBeenCalled()
  })

  it('deduplicates in-flight thumbnail work by thumbnail key', async () => {
    let resolveRender: ((url: string) => void) | undefined
    const renderThumbnail = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRender = resolve
        }),
    )
    const renderedBlob = new Blob(['thumbnail'])
    const fetchBlob = vi.fn(async () => renderedBlob)
    const service = createProjectThumbnailService({ renderThumbnail, fetchBlob })
    const page = createPageReference({ sourceFileId: 'source-b', sourcePageIndex: 0, rotation: 0 })
    const meta = createProjectMeta({ id: 'project-2' })

    const first = service.ensureThumbnail(meta, page)
    const second = service.ensureThumbnail(meta, page)
    resolveRender?.('blob://thumbnail')
    const [firstBlob, secondBlob] = await Promise.all([first, second])

    expect(renderThumbnail).toHaveBeenCalledTimes(1)
    expect(fetchBlob).toHaveBeenCalledTimes(1)
    expect(firstBlob).toBe(renderedBlob)
    expect(secondBlob).toBe(renderedBlob)
  })

  it('handles null page keys and returns undefined thumbnail', async () => {
    const renderThumbnail = vi.fn(async () => 'blob://thumbnail')
    const fetchBlob = vi.fn(async () => new Blob(['thumbnail']))
    const service = createProjectThumbnailService({ renderThumbnail, fetchBlob })
    const page = createPageReference({ sourceFileId: 'source-c', sourcePageIndex: 1, rotation: 180 })

    service.rememberThumbnailKey('project-3', page)
    const thumbnail = await service.ensureThumbnail(createProjectMeta({ id: 'project-3' }), null)

    expect(thumbnail).toBeUndefined()
    expect(getProjectThumbnailKey(null)).toBeNull()
    expect(renderThumbnail).not.toHaveBeenCalled()
    expect(fetchBlob).not.toHaveBeenCalled()
  })
})
