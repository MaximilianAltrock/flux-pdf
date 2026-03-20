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
    const renderThumbnailBlob = vi.fn(async () => new Blob(['new']))
    const service = createProjectThumbnailService({ renderThumbnailBlob })
    const page = createPageReference({ sourceFileId: 'source-a', sourcePageIndex: 2, rotation: 90 })
    const cachedBlob = new Blob(['cached'])

    service.rememberThumbnailKey('project-1', page)

    const thumbnail = await service.ensureThumbnail(
      createProjectMeta({ id: 'project-1', thumbnail: cachedBlob }),
      page,
    )

    expect(thumbnail).toBe(cachedBlob)
    expect(renderThumbnailBlob).not.toHaveBeenCalled()
  })

  it('deduplicates in-flight thumbnail work by thumbnail key', async () => {
    let resolveRender: ((blob: Blob) => void) | undefined
    const renderThumbnailBlob = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveRender = resolve
        }),
    )
    const renderedBlob = new Blob(['thumbnail'])
    const service = createProjectThumbnailService({ renderThumbnailBlob })
    const page = createPageReference({ sourceFileId: 'source-b', sourcePageIndex: 0, rotation: 0 })
    const meta = createProjectMeta({ id: 'project-2' })

    const first = service.ensureThumbnail(meta, page)
    const second = service.ensureThumbnail(meta, page)
    resolveRender?.(renderedBlob)
    const [firstBlob, secondBlob] = await Promise.all([first, second])

    expect(renderThumbnailBlob).toHaveBeenCalledTimes(1)
    expect(firstBlob).toBe(renderedBlob)
    expect(secondBlob).toBe(renderedBlob)
  })

  it('handles null page keys and returns undefined thumbnail', async () => {
    const renderThumbnailBlob = vi.fn(async () => new Blob(['thumbnail']))
    const service = createProjectThumbnailService({ renderThumbnailBlob })
    const page = createPageReference({ sourceFileId: 'source-c', sourcePageIndex: 1, rotation: 180 })

    service.rememberThumbnailKey('project-3', page)
    const thumbnail = await service.ensureThumbnail(createProjectMeta({ id: 'project-3' }), null)

    expect(thumbnail).toBeUndefined()
    expect(getProjectThumbnailKey(null)).toBeNull()
    expect(renderThumbnailBlob).not.toHaveBeenCalled()
  })
})
