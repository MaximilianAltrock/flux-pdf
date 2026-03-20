import { describe, expect, it, vi, afterEach } from 'vitest'
import { ThumbnailCacheOwner } from '@/shared/infrastructure/thumbnail-cache'

describe('thumbnail-cache', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deduplicates in-flight blob loads by cache key', async () => {
    const cache = new ThumbnailCacheOwner(10)
    let resolveBlob: ((blob: Blob) => void) | undefined
    const load = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveBlob = resolve
        }),
    )

    const first = cache.getBlob('thumb:a', load)
    const second = cache.getBlob('thumb:a', load)
    resolveBlob?.(new Blob(['a']))

    const [firstBlob, secondBlob] = await Promise.all([first, second])
    expect(load).toHaveBeenCalledTimes(1)
    expect(firstBlob).toBe(secondBlob)
  })

  it('reuses object urls and prunes unreferenced entries when the cache exceeds its limit', async () => {
    const createObjectUrl = vi.fn((blob: Blob) => `blob:${blob.size}:${createObjectUrl.mock.calls.length}`)
    const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrl,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrl,
      configurable: true,
      writable: true,
    })

    const cache = new ThumbnailCacheOwner(1)
    const firstBlob = new Blob(['one'])
    const secondBlob = new Blob(['two'])

    const firstUrl = cache.retainUrl('thumb:1', firstBlob)
    cache.releaseUrl('thumb:1')
    const secondUrl = cache.retainUrl('thumb:2', secondBlob)

    expect(firstUrl).toBe('blob:3:1')
    expect(secondUrl).toBe('blob:3:2')
    expect(createObjectUrl).toHaveBeenCalledTimes(2)
    expect(revokeObjectUrl).toHaveBeenCalledWith(firstUrl)
  })
})
