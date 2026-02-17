import { shallowRef } from 'vue'
import type { ProjectState } from '@/shared/infrastructure/db'
import {
  collectKeepSourceIds,
  resolveOrphanSourceIds,
  type GcStateSnapshot,
} from '@/domains/workspace/application/project-storage-gc'
import { createLogger } from '@/shared/infrastructure/logger'

export interface ProjectSourceGcRepository {
  listProjectStates(): Promise<ProjectState[]>
  listStoredFileKeys(): Promise<unknown[]>
  deleteStoredFiles(ids: string[]): Promise<void>
}

export interface ProjectSourceGcService {
  isRunning: ReturnType<typeof shallowRef<boolean>>
  run(currentState?: GcStateSnapshot): Promise<void>
}

export interface ProjectSourceGcServiceOptions {
  evictSourceCache?: (sourceIds: string[]) => void
  onError?: (error: unknown) => void
}

export function createProjectSourceGcService(
  repository: ProjectSourceGcRepository,
  options?: ProjectSourceGcServiceOptions,
): ProjectSourceGcService {
  const log = createLogger('project-source-gc')
  const isRunning = shallowRef(false)
  const evictSourceCache = options?.evictSourceCache ?? (() => {})
  const onError =
    options?.onError ??
    ((error: unknown) => {
      log.warn('Failed to garbage collect stored sources:', error)
    })

  async function run(currentState?: GcStateSnapshot): Promise<void> {
    if (isRunning.value) return
    isRunning.value = true

    try {
      const states = await repository.listProjectStates()
      const keepIds = collectKeepSourceIds(states, currentState)
      const storedKeys = await repository.listStoredFileKeys()
      const orphanIds = resolveOrphanSourceIds(storedKeys, keepIds)

      if (orphanIds.length === 0) return

      await repository.deleteStoredFiles(orphanIds)
      evictSourceCache(orphanIds)
    } catch (error) {
      onError(error)
    } finally {
      isRunning.value = false
    }
  }

  return {
    isRunning,
    run,
  }
}
