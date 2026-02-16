import { effectScope, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { TIMEOUTS_MS } from '@/shared/constants'
import type { GcStateSnapshot } from '@/domains/workspace/application/project-storage-gc'

export interface ProjectAutosaveServiceOptions {
  canPersist: () => boolean
  persistProject: () => Promise<void>
  collectGarbage: (state: GcStateSnapshot) => Promise<void>
  getLiveGcState: () => GcStateSnapshot
  saveWatchSource: () => readonly unknown[]
  gcWatchSource: () => readonly unknown[]
  debounceMs?: number
}

export interface ProjectAutosaveService {
  start(): void
}

export function createProjectAutosaveService(
  options: ProjectAutosaveServiceOptions,
): ProjectAutosaveService {
  const scope = effectScope(true)
  const debounceMs = options.debounceMs ?? TIMEOUTS_MS.SESSION_SAVE_DEBOUNCE
  let started = false

  function start(): void {
    if (started) return
    started = true

    scope.run(() => {
      const saveProject = useDebounceFn(async () => {
        if (!options.canPersist()) return
        await options.persistProject()
      }, debounceMs)

      const scheduleGc = useDebounceFn(async () => {
        await options.collectGarbage(options.getLiveGcState())
      }, debounceMs)

      watch(options.saveWatchSource, () => {
        void saveProject()
      })

      watch(options.gcWatchSource, () => {
        void scheduleGc()
      })
    })
  }

  return {
    start,
  }
}
