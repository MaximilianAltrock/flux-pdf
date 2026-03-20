import { onScopeDispose, shallowRef, watchEffect, type MaybeRefOrGetter, toValue } from 'vue'
import type { ProjectMeta } from '@/shared/infrastructure/db'
import { sharedWorkspaceThumbnailCache } from '@/shared/infrastructure/thumbnail-cache'

type ProjectListSource = MaybeRefOrGetter<ReadonlyArray<ProjectMeta>>

function buildThumbnailSignature(project: ProjectMeta): string | null {
  if (!project.thumbnail || !project.thumbnailKey) {
    return null
  }

  return `page:${project.thumbnailKey}`
}

function getWorkspaceThumbnailCacheKey(project: ProjectMeta): string | null {
  const signature = buildThumbnailSignature(project)
  if (!signature) return null
  return `workspace:${project.id}:${signature}`
}

export function useProjectThumbnailUrls(projectsSource: ProjectListSource) {
  const thumbnailUrlById = shallowRef<Record<string, string | undefined>>({})
  const publishedKeyByProjectId = new Map<string, string>()

  function publishThumbnailUrls(projects: ReadonlyArray<ProjectMeta>): void {
    const nextUrls: Record<string, string | undefined> = {}
    const nextKeysByProjectId = new Map<string, string>()

    for (const project of projects) {
      const cacheKey = getWorkspaceThumbnailCacheKey(project)
      const blob = project.thumbnail
      if (!cacheKey || !blob) continue

      nextKeysByProjectId.set(project.id, cacheKey)
      const previousKey = publishedKeyByProjectId.get(project.id)

      if (previousKey === cacheKey) {
        nextUrls[project.id] = thumbnailUrlById.value[project.id]
        continue
      }

      if (previousKey) {
        sharedWorkspaceThumbnailCache.releaseUrl(previousKey)
        publishedKeyByProjectId.delete(project.id)
      }

      nextUrls[project.id] = sharedWorkspaceThumbnailCache.retainUrl(cacheKey, blob)
      publishedKeyByProjectId.set(project.id, cacheKey)
    }

    for (const [projectId, cacheKey] of publishedKeyByProjectId) {
      if (nextKeysByProjectId.has(projectId)) continue
      sharedWorkspaceThumbnailCache.releaseUrl(cacheKey)
      publishedKeyByProjectId.delete(projectId)
    }

    thumbnailUrlById.value = nextUrls
  }

  function clearThumbnailUrls(): void {
    for (const cacheKey of publishedKeyByProjectId.values()) {
      sharedWorkspaceThumbnailCache.releaseUrl(cacheKey)
    }
    publishedKeyByProjectId.clear()
    thumbnailUrlById.value = {}
  }

  function thumbnailFor(project: Pick<ProjectMeta, 'id'>): string | undefined {
    return thumbnailUrlById.value[project.id]
  }

  watchEffect(() => {
    const projects = toValue(projectsSource)
    publishThumbnailUrls(projects)
  })

  onScopeDispose(clearThumbnailUrls)

  return {
    thumbnailUrlById,
    thumbnailFor,
    clearThumbnailUrls,
  }
}
