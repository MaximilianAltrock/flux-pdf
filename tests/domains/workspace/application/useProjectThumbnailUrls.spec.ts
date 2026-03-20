import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { useProjectThumbnailUrls } from '@/domains/workspace/application/useProjectThumbnailUrls'
import type { ProjectMeta } from '@/shared/infrastructure/db'
import { sharedRenderedThumbnailCache, sharedWorkspaceThumbnailCache } from '@/shared/infrastructure/thumbnail-cache'

function createProjectMeta(partial: Partial<ProjectMeta>): ProjectMeta {
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

describe('useProjectThumbnailUrls', () => {
  const scopes: EffectScope[] = []
  let createObjectUrlSpy: ReturnType<typeof vi.fn>
  let revokeObjectUrlSpy: ReturnType<typeof vi.fn>

  afterEach(() => {
    while (scopes.length > 0) {
      scopes.pop()?.stop()
    }
    sharedRenderedThumbnailCache.clear()
    sharedWorkspaceThumbnailCache.clear()
    vi.restoreAllMocks()
  })

  function stubObjectUrls() {
    let nextUrlId = 0
    createObjectUrlSpy = vi.fn(() => `blob:test-${++nextUrlId}`)
    revokeObjectUrlSpy = vi.fn()

    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrlSpy,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrlSpy,
      configurable: true,
      writable: true,
    })
  }

  function createHarness(initialProjects: ProjectMeta[] = []) {
    const projects = ref(initialProjects)
    const scope = effectScope()
    const state = scope.run(() => useProjectThumbnailUrls(projects))
    if (!state) {
      throw new Error('Failed to create thumbnail url harness')
    }
    scopes.push(scope)
    return { projects, scope, state }
  }

  it('updates exposed urls when a thumbnail blob is added to an existing project entry', async () => {
    stubObjectUrls()
    const project = createProjectMeta({ id: 'project-1' })
    const { projects, state } = createHarness([project])

    await nextTick()
    expect(state.thumbnailUrlById.value['project-1']).toBeUndefined()

    projects.value[0] = createProjectMeta({
      ...projects.value[0],
      thumbnail: new Blob(['thumb']),
      thumbnailKey: 'source-1-0-0',
    })
    await nextTick()

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(state.thumbnailUrlById.value['project-1']).toBe('blob:test-1')
    expect(state.thumbnailFor(project)).toBe('blob:test-1')
  })

  it('keeps the cached url stable when only project timestamps change', async () => {
    stubObjectUrls()
    const projects = ref([
      createProjectMeta({
        id: 'project-stable',
        updatedAt: 10,
        thumbnail: new Blob(['thumb']),
        thumbnailKey: 'source-1-0-0',
      }),
    ])
    const scope = effectScope()
    const state = scope.run(() => useProjectThumbnailUrls(projects))
    if (!state) {
      throw new Error('Failed to create thumbnail url harness')
    }
    scopes.push(scope)

    await nextTick()
    expect(state.thumbnailUrlById.value['project-stable']).toBe('blob:test-1')

    projects.value = [
      createProjectMeta({
        id: 'project-stable',
        updatedAt: 20,
        thumbnail: new Blob(['thumb']),
        thumbnailKey: 'source-1-0-0',
      }),
    ]
    await nextTick()

    expect(state.thumbnailUrlById.value['project-stable']).toBe('blob:test-1')
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled()
  })

  it('does not publish thumbnails without a thumbnail key', async () => {
    stubObjectUrls()
    const project = createProjectMeta({
      id: 'project-3',
      thumbnail: new Blob(['thumb']),
    })
    const { state } = createHarness([project])
    await nextTick()

    expect(state.thumbnailUrlById.value['project-3']).toBeUndefined()
    expect(state.thumbnailFor(project)).toBeUndefined()
    expect(createObjectUrlSpy).not.toHaveBeenCalled()
  })

  it('reuses cached thumbnail urls across composable remounts', async () => {
    stubObjectUrls()
    const project = createProjectMeta({
      id: 'project-2',
      thumbnail: new Blob(['thumb']),
      thumbnailKey: 'source-1-0-0',
    })
    const { scope, state } = createHarness([project])

    await nextTick()
    const thumbnailUrl = state.thumbnailUrlById.value['project-2']
    expect(thumbnailUrl).toBe('blob:test-1')

    scope.stop()
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled()

    const remounted = createHarness([project])
    await nextTick()

    expect(remounted.state.thumbnailUrlById.value['project-2']).toBe('blob:test-1')
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
  })

  it('shares one retained workspace url across simultaneous consumers', async () => {
    stubObjectUrls()
    const project = createProjectMeta({
      id: 'project-shared',
      thumbnail: new Blob(['thumb']),
      thumbnailKey: 'source-1-0-0',
    })
    const first = createHarness([project])
    const second = createHarness([project])

    await nextTick()

    expect(first.state.thumbnailUrlById.value['project-shared']).toBe('blob:test-1')
    expect(second.state.thumbnailUrlById.value['project-shared']).toBe('blob:test-1')
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)

    first.scope.stop()
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled()
    expect(second.state.thumbnailUrlById.value['project-shared']).toBe('blob:test-1')
  })

  it('keeps workspace thumbnail urls isolated from rendered thumbnail cache clears', async () => {
    stubObjectUrls()
    const project = createProjectMeta({
      id: 'project-isolated',
      thumbnail: new Blob(['thumb']),
      thumbnailKey: 'source-1-0-0',
    })
    const { state } = createHarness([project])
    await nextTick()

    expect(state.thumbnailUrlById.value['project-isolated']).toBe('blob:test-1')

    sharedRenderedThumbnailCache.clear()

    expect(state.thumbnailUrlById.value['project-isolated']).toBe('blob:test-1')
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled()
  })

  it('replaces the current url when a project thumbnail key changes without revoking shared cache entries eagerly', async () => {
    stubObjectUrls()
    const project = createProjectMeta({
      id: 'project-rotate',
      thumbnail: new Blob(['thumb-a']),
      thumbnailKey: 'source-1-0-0',
    })
    const { projects, state } = createHarness([project])
    await nextTick()

    expect(state.thumbnailUrlById.value['project-rotate']).toBe('blob:test-1')

    projects.value = [
      createProjectMeta({
        id: 'project-rotate',
        thumbnail: new Blob(['thumb-b']),
        thumbnailKey: 'source-1-0-90',
      }),
    ]
    await nextTick()

    expect(state.thumbnailUrlById.value['project-rotate']).toBe('blob:test-2')
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(2)
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled()
  })
})
