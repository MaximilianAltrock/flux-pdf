import { nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProjectAutosaveService } from '@/domains/project-session/application/project-autosave.service'
import type { GcStateSnapshot } from '@/domains/project-session/domain/project-storage-gc'

describe('project-autosave.service', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces save and gc triggers from watch sources', async () => {
    vi.useFakeTimers()
    const canPersist = ref(true)
    const saveVersion = ref(0)
    const gcVersion = ref(0)
    const liveState: GcStateSnapshot = { activeSourceIds: ['s1'], pages: [], history: [] }
    const buildSnapshot = vi.fn(() => ({ gcState: liveState, id: 'snapshot-1' }))
    const persistProject = vi.fn(async (_snapshot: { gcState: GcStateSnapshot; id: string }) => {})
    const collectGarbage = vi.fn(async (_snapshot: { gcState: GcStateSnapshot; id: string }) => {})
    const service = createProjectAutosaveService({
      canPersist: () => canPersist.value,
      buildSnapshot,
      persistProject,
      collectGarbage,
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

    expect(buildSnapshot).toHaveBeenCalledTimes(1)
    expect(persistProject).toHaveBeenCalledTimes(1)
    expect(collectGarbage).toHaveBeenCalledTimes(1)
    expect(collectGarbage).toHaveBeenCalledWith({ gcState: liveState, id: 'snapshot-1' })
  })

  it('is idempotent and honors persist guard', async () => {
    vi.useFakeTimers()
    const canPersist = ref(false)
    const saveVersion = ref(0)
    const buildSnapshot = vi.fn(() => ({
      gcState: { activeSourceIds: [], pages: [], history: [] },
      id: 'snapshot-2',
    }))
    const persistProject = vi.fn(async () => {})
    const service = createProjectAutosaveService({
      canPersist: () => canPersist.value,
      buildSnapshot,
      persistProject,
      collectGarbage: vi.fn(async () => {}),
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
    expect(buildSnapshot).toHaveBeenCalledTimes(1)
    expect(persistProject).not.toHaveBeenCalled()

    canPersist.value = true
    saveVersion.value += 1
    await nextTick()
    vi.advanceTimersByTime(10)
    await Promise.resolve()
    expect(buildSnapshot).toHaveBeenCalledTimes(2)
    expect(persistProject).toHaveBeenCalledTimes(1)
  })
})
