import { describe, expect, it } from 'vitest'
import { COMMAND_SCHEMA_VERSION } from '@/commands'
import { HISTORY, SCHEMA_VERSION, ZOOM } from '@/constants'
import { migrateLegacySessionState, type LegacySessionStateRecord } from '@/domain/document/project'

describe('migrateLegacySessionState', () => {
  it('adds schema and command versions to legacy sessions', () => {
    const legacy: LegacySessionStateRecord = {
      id: 'current-session',
      projectTitle: 'Legacy',
      activeSourceIds: [],
      pageMap: [],
      history: [{ type: 'Unknown', payload: { id: 'cmd-1' }, timestamp: 1 }],
      historyPointer: HISTORY.POINTER_START,
      zoom: ZOOM.PERCENT_BASE,
      updatedAt: 0,
    }

    const migrated = migrateLegacySessionState(legacy)

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION.SESSION)
    expect(migrated.history[0]?.version).toBe(COMMAND_SCHEMA_VERSION)
    expect(migrated.bookmarksDirty).toBe(false)
    expect(migrated.metadataDirty).toBe(false)
  })
})
