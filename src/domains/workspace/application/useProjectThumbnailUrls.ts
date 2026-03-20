import { onScopeDispose, shallowRef, watchEffect, type MaybeRefOrGetter, toValue } from 'vue'
import type { ProjectMeta } from '@/shared/infrastructure/db'

type ProjectListSource = MaybeRefOrGetter<ReadonlyArray<ProjectMeta>>

type WorkspaceThumbnailCacheEntry = {
  signature: string
  url: string
}

const workspaceThumbnailCache = new Map<string, WorkspaceThumbnailCacheEntry>()

function buildThumbnailSignature(project: ProjectMeta): string | null {
  if (!project.thumbnail || !project.thumbnailKey) {
    return null
  }

  return `page:${project.thumbnailKey}`
}

function getExactCachedThumbnailUrl(project: ProjectMeta): string | undefined {
  const signature = buildThumbnailSignature(project)
  if (!signature) return undefined
  const existing = workspaceThumbnailCache.get(project.id)
  if (existing?.signature === signature) {
    return existing.url
  }

  return undefined
}

function storeCachedThumbnail(project: ProjectMeta): string | undefined {
  const signature = buildThumbnailSignature(project)
  const blob = project.thumbnail
  if (!signature || !blob) {
    return undefined
  }

  const existing = workspaceThumbnailCache.get(project.id)
  if (existing?.signature === signature) {
    return existing.url
  }

  if (existing) {
    URL.revokeObjectURL(existing.url)
  }

  const url = URL.createObjectURL(blob)
  workspaceThumbnailCache.set(project.id, { signature, url })
  return url
}

export function useProjectThumbnailUrls(projectsSource: ProjectListSource) {
  const thumbnailUrlById = shallowRef<Record<string, string | undefined>>({})

  function publishThumbnailUrls(projects: ReadonlyArray<ProjectMeta>): void {
    const nextUrls: Record<string, string | undefined> = {}
    for (const project of projects) {
      nextUrls[project.id] = getExactCachedThumbnailUrl(project) ?? storeCachedThumbnail(project)
    }
    thumbnailUrlById.value = nextUrls
  }

  function clearThumbnailUrls(): void {
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
