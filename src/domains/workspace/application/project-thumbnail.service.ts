import type { ProjectMeta } from '@/shared/infrastructure/db'
import type { PageReference } from '@/shared/types'

export interface ProjectThumbnailServiceOptions {
  renderThumbnail: (page: PageReference) => Promise<string>
  fetchBlob?: (url: string) => Promise<Blob>
}

export interface ProjectThumbnailService {
  ensureThumbnail(meta: ProjectMeta, page: PageReference | null): Promise<Blob | undefined>
  rememberThumbnailKey(projectId: string, page: PageReference | null): void
}

export function getProjectThumbnailKey(page: PageReference | null): string | null {
  if (!page) return null
  return `${page.sourceFileId}-${page.sourcePageIndex}-${page.rotation}`
}

export function createProjectThumbnailService(
  options: ProjectThumbnailServiceOptions,
): ProjectThumbnailService {
  const thumbnailKeyByProject = new Map<string, string | null>()
  const thumbnailInFlight = new Map<string, Promise<Blob | undefined>>()

  const fetchBlob =
    options.fetchBlob ??
    (async (url: string) => {
      const response = await fetch(url)
      return response.blob()
    })

  async function ensureThumbnail(
    meta: ProjectMeta,
    page: PageReference | null,
  ): Promise<Blob | undefined> {
    if (!page) {
      thumbnailKeyByProject.set(meta.id, null)
      return undefined
    }

    const key = getProjectThumbnailKey(page)
    if (!key) return undefined
    const existingKey = thumbnailKeyByProject.get(meta.id) ?? null

    if (key && existingKey === key && meta.thumbnail) {
      return meta.thumbnail
    }

    if (thumbnailInFlight.has(key)) {
      return thumbnailInFlight.get(key)
    }

    const job = options
      .renderThumbnail(page)
      .then((url) => fetchBlob(url))
      .then((blob) => {
        thumbnailKeyByProject.set(meta.id, key)
        return blob
      })
      .finally(() => {
        thumbnailInFlight.delete(key)
      })

    thumbnailInFlight.set(key, job)
    return job
  }

  function rememberThumbnailKey(projectId: string, page: PageReference | null): void {
    thumbnailKeyByProject.set(projectId, getProjectThumbnailKey(page))
  }

  return {
    ensureThumbnail,
    rememberThumbnailKey,
  }
}
