import { describe, expect, it } from 'vitest'
import { migrateSessionState, SESSION_SCHEMA_VERSION } from '@/domain/document/session'
import type { SessionStateRecord } from '@/domain/document/session'

describe('migrateSessionState', () => {
  it('adds schema and command versions to legacy sessions', () => {
    const legacy: SessionStateRecord = {
      id: 'current-session',
      projectTitle: 'Legacy',
      activeSourceIds: [],
      pageMap: [],
      history: [{ type: 'Unknown', payload: { id: 'cmd-1' }, timestamp: 1 }],
      historyPointer: -1,
      zoom: 200,
      updatedAt: 0,
    }

    const migrated = migrateSessionState(legacy)

    expect(migrated.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    expect(migrated.history[0]?.version).toBe(1)
    expect(migrated.bookmarksDirty).toBe(false)
    expect(migrated.metadataDirty).toBe(false)
  })
})
