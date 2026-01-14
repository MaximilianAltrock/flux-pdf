import { describe, expect, it } from 'vitest'
import { COMMAND_SCHEMA_VERSION } from '@/commands'
import { HISTORY, ZOOM } from '@/constants'
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
      historyPointer: HISTORY.POINTER_START,
      zoom: ZOOM.PERCENT_BASE,
      updatedAt: 0,
    }

    const migrated = migrateSessionState(legacy)

    expect(migrated.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    expect(migrated.history[0]?.version).toBe(COMMAND_SCHEMA_VERSION)
    expect(migrated.bookmarksDirty).toBe(false)
    expect(migrated.metadataDirty).toBe(false)
  })
})
