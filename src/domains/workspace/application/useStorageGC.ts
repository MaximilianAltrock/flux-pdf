import { shallowRef } from 'vue'
import { db, type ProjectState } from '@/shared/infrastructure/db'
import { collectReachableSourceIdsFromState } from '@/domains/document/domain/storage-gc'
import { clearPdfCache } from '@/domains/document/infrastructure/import'
import { useThumbnailRenderer } from '@/domains/document/application/useThumbnailRenderer'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { useHistoryStore } from '@/domains/history/store/history.store'
import { useProjectsStore } from '@/domains/workspace/store/projects.store'
import { useSettingsStore } from '@/domains/workspace/store/settings.store'
import { STORAGE_KEYS } from '@/shared/constants'

type SourceUsage = {
  active: boolean
  trash: boolean
}

export interface StorageBreakdown {
  activeBytes: number
  trashBytes: number
  cacheBytes: number
  usedBytes: number
  quotaBytes: number | null
  freeBytes: number | null
}

const EMPTY_BREAKDOWN: StorageBreakdown = {
  activeBytes: 0,
  trashBytes: 0,
  cacheBytes: 0,
  usedBytes: 0,
  quotaBytes: null,
  freeBytes: null,
}

function resolveFileSizeBytes(fileSize: unknown, buffer: ArrayBuffer): number {
  if (typeof fileSize === 'number' && Number.isFinite(fileSize) && fileSize > 0) {
    return fileSize
  }
  return Math.max(0, buffer.byteLength)
}

async function resolveStorageQuotaBytes(): Promise<number | null> {
  if (typeof navigator === 'undefined' || typeof navigator.storage?.estimate !== 'function') {
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    const quota = Number(estimate.quota ?? 0)
    return Number.isFinite(quota) && quota > 0 ? quota : null
  } catch (error) {
    console.warn('Failed to read storage estimate:', error)
    return null
  }
}

function collectSourceUsageById(options: {
  trashedProjectIds: Set<string>
  states: ReadonlyArray<ProjectState>
}): Map<string, SourceUsage> {
  const usageBySourceId = new Map<string, SourceUsage>()

  for (const state of options.states) {
    const isTrashed = options.trashedProjectIds.has(state.id)
    const reachableSourceIds = collectReachableSourceIdsFromState({
      activeSourceIds: state.activeSourceIds ?? [],
      pages: state.pageMap ?? [],
      history: state.history ?? [],
    })

    for (const sourceId of reachableSourceIds) {
      const usage = usageBySourceId.get(sourceId) ?? { active: false, trash: false }
      if (isTrashed) {
        usage.trash = true
      } else {
        usage.active = true
      }
      usageBySourceId.set(sourceId, usage)
    }
  }

  return usageBySourceId
}

export function useStorageGC() {
  const projectsStore = useProjectsStore()
  const documentStore = useDocumentStore()
  const historyStore = useHistoryStore()
  const settingsStore = useSettingsStore()
  const { clearCache: clearThumbnailCache } = useThumbnailRenderer()

  const breakdown = shallowRef<StorageBreakdown>({ ...EMPTY_BREAKDOWN })
  const isRefreshingStorage = shallowRef(false)

  async function computeStorageBreakdown(): Promise<StorageBreakdown> {
    const [projects, states, files, quotaBytes] = await Promise.all([
      db.projects.toArray(),
      db.states.toArray(),
      db.files.toArray(),
      resolveStorageQuotaBytes(),
    ])

    const trashedProjectIds = new Set(
      projects.filter((project) => typeof project.trashedAt === 'number').map((project) => project.id),
    )
    const sourceUsageById = collectSourceUsageById({
      trashedProjectIds,
      states,
    })

    let activeBytes = 0
    let trashBytes = 0
    let cacheBytes = 0

    for (const file of files) {
      const sizeBytes = resolveFileSizeBytes(file.fileSize, file.data)
      const usage = sourceUsageById.get(file.id)

      if (usage?.active) {
        activeBytes += sizeBytes
        continue
      }

      if (usage?.trash) {
        trashBytes += sizeBytes
        continue
      }

      cacheBytes += sizeBytes
    }

    const usedBytes = activeBytes + trashBytes + cacheBytes
    const freeBytes = quotaBytes === null ? null : Math.max(0, quotaBytes - usedBytes)

    return {
      activeBytes,
      trashBytes,
      cacheBytes,
      usedBytes,
      quotaBytes,
      freeBytes,
    }
  }

  async function refreshStorage(): Promise<StorageBreakdown> {
    isRefreshingStorage.value = true
    try {
      const next = await computeStorageBreakdown()
      breakdown.value = next
      return next
    } finally {
      isRefreshingStorage.value = false
    }
  }

  async function emptyTrash(): Promise<number> {
    const deletedCount = await projectsStore.emptyTrash()
    await refreshStorage()
    return deletedCount
  }

  async function runGarbageCollection(): Promise<void> {
    await projectsStore.runGarbageCollection()
    clearPdfCache()
    clearThumbnailCache()
    await refreshStorage()
  }

  async function nukeAllData(): Promise<void> {
    await Promise.all([
      db.projects.clear(),
      db.states.clear(),
      db.files.clear(),
      db.workflows.clear(),
    ])

    projectsStore.activeProjectId = null
    projectsStore.activeProjectMeta = null
    projectsStore.setLastActiveProjectId(null)

    documentStore.reset()
    historyStore.clearHistory()
    settingsStore.resetPreferences()

    clearPdfCache()
    clearThumbnailCache()

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE_PROJECT_ID)
    }

    await refreshStorage()
  }

  return {
    breakdown,
    isRefreshingStorage,
    refreshStorage,
    emptyTrash,
    runGarbageCollection,
    nukeAllData,
  }
}


