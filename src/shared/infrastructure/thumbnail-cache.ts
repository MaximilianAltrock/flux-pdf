import { THUMBNAIL } from '@/shared/constants'

type ThumbnailCacheEntry = {
  blob: Blob
  url: string | null
  refCount: number
  lastAccessed: number
}

export class ThumbnailCacheOwner {
  private readonly entries = new Map<string, ThumbnailCacheEntry>()
  private readonly inFlight = new Map<string, Promise<Blob>>()

  constructor(private readonly maxEntries = THUMBNAIL.CACHE_MAX) {}

  async getBlob(key: string, load: () => Promise<Blob>): Promise<Blob> {
    const existing = this.entries.get(key)
    if (existing) {
      existing.lastAccessed = Date.now()
      return existing.blob
    }

    const pending = this.inFlight.get(key)
    if (pending) {
      return pending
    }

    const job = load()
      .then((blob) => {
        this.upsertBlob(key, blob)
        return blob
      })
      .finally(() => {
        this.inFlight.delete(key)
      })

    this.inFlight.set(key, job)
    return job
  }

  retainUrl(key: string, blob: Blob): string {
    const entry = this.upsertBlob(key, blob)
    if (!entry.url) {
      entry.url = URL.createObjectURL(entry.blob)
    }
    entry.refCount += 1
    entry.lastAccessed = Date.now()
    return entry.url
  }

  releaseUrl(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    entry.refCount = Math.max(0, entry.refCount - 1)
    entry.lastAccessed = Date.now()
    this.prune()
  }

  forget(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    if (entry.url) {
      URL.revokeObjectURL(entry.url)
    }
    this.entries.delete(key)
    this.inFlight.delete(key)
  }

  clear(): void {
    for (const key of this.entries.keys()) {
      this.forget(key)
    }
  }

  private upsertBlob(key: string, blob: Blob): ThumbnailCacheEntry {
    const existing = this.entries.get(key)
    if (existing) {
      existing.lastAccessed = Date.now()
      if (existing.blob !== blob) {
        if (existing.url) {
          URL.revokeObjectURL(existing.url)
        }
        existing.blob = blob
        existing.url = null
      }
      return existing
    }

    const entry: ThumbnailCacheEntry = {
      blob,
      url: null,
      refCount: 0,
      lastAccessed: Date.now(),
    }
    this.entries.set(key, entry)
    this.prune()
    return entry
  }

  private prune(): void {
    if (this.entries.size <= this.maxEntries) return

    const releasable = [...this.entries.entries()]
      .filter(([, entry]) => entry.refCount === 0)
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    while (this.entries.size > this.maxEntries && releasable.length > 0) {
      const next = releasable.shift()
      if (!next) break
      this.forget(next[0])
    }
  }
}

export const sharedRenderedThumbnailCache = new ThumbnailCacheOwner()
export const sharedWorkspaceThumbnailCache = new ThumbnailCacheOwner()
