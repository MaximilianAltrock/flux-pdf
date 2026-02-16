import { describe, expect, it } from 'vitest'
import {
  collectKeepSourceIds,
  resolveOrphanSourceIds,
  type GcStateSnapshot,
} from '@/domains/workspace/application/project-storage-gc'
import type { ProjectState } from '@/shared/infrastructure/db'

function createState(partial: Partial<ProjectState>): ProjectState {
  return {
    id: partial.id ?? crypto.randomUUID(),
    activeSourceIds: partial.activeSourceIds ?? [],
    pageMap: partial.pageMap ?? [],
    history: partial.history ?? [],
    historyPointer: partial.historyPointer ?? -1,
    zoom: partial.zoom ?? 1,
    updatedAt: partial.updatedAt ?? Date.now(),
    outlineTree: partial.outlineTree,
    outlineDirty: partial.outlineDirty,
    metadata: partial.metadata,
    security: partial.security,
    metadataDirty: partial.metadataDirty,
    ignoredPreflightRuleIds: partial.ignoredPreflightRuleIds,
  }
}

describe('project-storage-gc', () => {
  it('collects keep ids from persisted states and live snapshot', () => {
    const states = [
      createState({
        activeSourceIds: ['s1'],
        pageMap: [{ id: 'p1', sourceFileId: 's2', sourcePageIndex: 0, rotation: 0, groupId: 'g1' }],
      }),
      createState({
        history: [
          {
            type: 'Test',
            payload: { id: 'cmd', sourceFileId: 's3' },
            timestamp: Date.now(),
          },
        ],
      }),
    ]

    const current: GcStateSnapshot = {
      activeSourceIds: ['s4'],
      pages: [{ id: 'p2', sourceFileId: 's5', sourcePageIndex: 0, rotation: 0, groupId: 'g2' }],
      history: [],
    }

    const keepIds = collectKeepSourceIds(states, current)

    expect(Array.from(keepIds).sort()).toEqual(['s1', 's2', 's3', 's4', 's5'])
  })

  it('resolves orphan ids by removing reachable ids', () => {
    const orphanIds = resolveOrphanSourceIds(['s1', 's2', 3, 's4'], new Set(['s2', '3']))
    expect(orphanIds).toEqual(['s1', 's4'])
  })
})
