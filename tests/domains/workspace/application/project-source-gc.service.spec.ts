import { describe, expect, it, vi } from 'vitest'
import type { ProjectState } from '@/shared/infrastructure/db'
import {
  createProjectSourceGcService,
  type ProjectSourceGcRepository,
} from '@/domains/workspace/application/project-source-gc.service'
import type { GcStateSnapshot } from '@/domains/workspace/application/project-storage-gc'

function createProjectState(partial: Partial<ProjectState>): ProjectState {
  return {
    id: partial.id ?? crypto.randomUUID(),
    activeSourceIds: partial.activeSourceIds ?? [],
    pageMap: partial.pageMap ?? [],
    history: partial.history ?? [],
    historyPointer: partial.historyPointer ?? -1,
    zoom: partial.zoom ?? 220,
    updatedAt: partial.updatedAt ?? Date.now(),
    outlineTree: partial.outlineTree,
    outlineDirty: partial.outlineDirty,
    metadata: partial.metadata,
    security: partial.security,
    metadataDirty: partial.metadataDirty,
    ignoredPreflightRuleIds: partial.ignoredPreflightRuleIds,
  }
}

describe('project-source-gc.service', () => {
  it('deletes orphan source ids and evicts cache', async () => {
    const deleteStoredFiles = vi.fn(async () => {})
    const repository: ProjectSourceGcRepository = {
      listProjectStates: async () => [
        createProjectState({
          activeSourceIds: ['keep-1'],
          pageMap: [{ id: 'p1', sourceFileId: 'keep-2', sourcePageIndex: 0, rotation: 0 }],
        }),
      ],
      listStoredFileKeys: async () => ['keep-1', 'keep-2', 'orphan', 77],
      deleteStoredFiles,
    }
    const evictSourceCache = vi.fn()
    const service = createProjectSourceGcService(repository, { evictSourceCache })
    const liveState: GcStateSnapshot = {
      activeSourceIds: [],
      pages: [],
      history: [],
    }

    await service.run(liveState)

    expect(deleteStoredFiles).toHaveBeenCalledWith(['orphan', '77'])
    expect(evictSourceCache).toHaveBeenCalledWith(['orphan', '77'])
    expect(service.isRunning.value).toBe(false)
  })

  it('skips delete when no orphan source exists', async () => {
    const deleteStoredFiles = vi.fn(async () => {})
    const repository: ProjectSourceGcRepository = {
      listProjectStates: async () => [
        createProjectState({ activeSourceIds: ['keep-1', 'keep-2'] }),
      ],
      listStoredFileKeys: async () => ['keep-1', 'keep-2'],
      deleteStoredFiles,
    }
    const evictSourceCache = vi.fn()
    const service = createProjectSourceGcService(repository, { evictSourceCache })

    await service.run()

    expect(deleteStoredFiles).not.toHaveBeenCalled()
    expect(evictSourceCache).not.toHaveBeenCalled()
  })

  it('guards against overlapping gc runs', async () => {
    let resolveStates: ((states: ProjectState[]) => void) | undefined
    const repository: ProjectSourceGcRepository = {
      listProjectStates: vi.fn(
        () =>
          new Promise<ProjectState[]>((resolve) => {
            resolveStates = resolve
          }),
      ),
      listStoredFileKeys: async () => [],
      deleteStoredFiles: async () => {},
    }
    const service = createProjectSourceGcService(repository)

    const firstRun = service.run()
    const secondRun = service.run()
    await secondRun
    resolveStates?.([createProjectState({ activeSourceIds: [] })])
    await firstRun

    expect(repository.listProjectStates).toHaveBeenCalledTimes(1)
  })
})
