import { nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProjectAutosaveService } from '@/domains/workspace/application/project-autosave.service'
import type { GcStateSnapshot } from '@/domains/workspace/application/project-storage-gc'

describe('project-autosave.service', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces save and gc triggers from watch sources', async () => {
    vi.useFakeTimers()
    const canPersist = ref(true)
    const saveVersion = ref(0)
    const gcVersion = ref(0)
    const persistProject = vi.fn(async () => {})
    const liveState: GcStateSnapshot = { activeSourceIds: ['s1'], pages: [], history: [] }
    const collectGarbage = vi.fn(async (_state: GcStateSnapshot) => {})
    const service = createProjectAutosaveService({
      canPersist: () => canPersist.value,
      persistProject,
      collectGarbage,
      getLiveGcState: () => liveState,
      saveWatchSource: () => [saveVersion.value],
      gcWatchSource: () => [gcVersion.value],
      debounceMs: 25,
    })

    service.start()
    saveVersion.value += 1
    gcVersion.value += 1
    await nextTick()
    vi.advanceTimersByTime(25)
    await Promise.resolve()

    expect(persistProject).toHaveBeenCalledTimes(1)
    expect(collectGarbage).toHaveBeenCalledTimes(1)
    expect(collectGarbage).toHaveBeenCalledWith(liveState)
  })

  it('is idempotent and honors persist guard', async () => {
    vi.useFakeTimers()
    const canPersist = ref(false)
    const saveVersion = ref(0)
    const persistProject = vi.fn(async () => {})
    const service = createProjectAutosaveService({
      canPersist: () => canPersist.value,
      persistProject,
      collectGarbage: vi.fn(async () => {}),
      getLiveGcState: () => ({ activeSourceIds: [], pages: [], history: [] }),
      saveWatchSource: () => [saveVersion.value],
      gcWatchSource: () => [],
      debounceMs: 10,
    })

    service.start()
    service.start()

    saveVersion.value += 1
    await nextTick()
    vi.advanceTimersByTime(10)
    await Promise.resolve()
    expect(persistProject).not.toHaveBeenCalled()

    canPersist.value = true
    saveVersion.value += 1
    await nextTick()
    vi.advanceTimersByTime(10)
    await Promise.resolve()
    expect(persistProject).toHaveBeenCalledTimes(1)
  })
})
