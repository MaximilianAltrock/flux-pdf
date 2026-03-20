import { effectScope, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { TIMEOUTS_MS } from '@/shared/constants'
import type { GcStateSnapshot } from '@/domains/project-session/domain/project-storage-gc'

export interface ProjectAutosaveSnapshot {
  gcState: GcStateSnapshot
}

export interface ProjectAutosaveServiceOptions<TSnapshot extends ProjectAutosaveSnapshot> {
  canPersist: () => boolean
  buildSnapshot: () => TSnapshot
  persistProject: (snapshot: TSnapshot) => Promise<void>
  collectGarbage: (snapshot: TSnapshot) => Promise<void>
  saveWatchSource: () => readonly unknown[]
  gcWatchSource: () => readonly unknown[]
  debounceMs?: number
}

export interface ProjectAutosaveService {
  start(): void
  stop(): void
}

export function createProjectAutosaveService<TSnapshot extends ProjectAutosaveSnapshot>(
  options: ProjectAutosaveServiceOptions<TSnapshot>,
): ProjectAutosaveService {
  const scope = effectScope(true)
  const debounceMs = options.debounceMs ?? TIMEOUTS_MS.SESSION_SAVE_DEBOUNCE
  let started = false

  function start(): void {
    if (started) return
    started = true

    scope.run(() => {
      let needsPersist = false
      let needsGc = false

      const flushSnapshot = useDebounceFn(async () => {
        if (!needsPersist && !needsGc) return

        const shouldPersist = needsPersist
        const shouldGc = needsGc
        needsPersist = false
        needsGc = false

        const snapshot = options.buildSnapshot()
        if (shouldPersist && options.canPersist()) {
          await options.persistProject(snapshot)
        }
        if (shouldGc) {
          await options.collectGarbage(snapshot)
        }
      }, debounceMs)

      watch(options.saveWatchSource, () => {
        needsPersist = true
        void flushSnapshot()
      })

      watch(options.gcWatchSource, () => {
        needsGc = true
        void flushSnapshot()
      })
    })
  }

  return {
    start,
    stop() {
      scope.stop()
      started = false
    },
  }
}
