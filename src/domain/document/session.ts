import { SCHEMA_VERSION } from '@/constants'
import { db, type SessionState } from '@/db/db'
import type { PageEntry, DocumentMetadata, SecurityMetadata } from '@/types'
import type { SerializedCommand } from '@/commands'
import { migrateSerializedCommands, type SerializedCommandRecord } from '@/commands/migrations'

export interface SessionSnapshot {
  projectTitle: string
  activeSourceIds: string[]
  pageMap: PageEntry[]
  history: SerializedCommand[]
  historyPointer: number
  zoom: number
  bookmarksTree?: unknown[]
  bookmarksDirty?: boolean
  metadata?: DocumentMetadata
  security?: SecurityMetadata
  metadataDirty?: boolean
}

export const SESSION_SCHEMA_VERSION = SCHEMA_VERSION.SESSION

export type SessionStateRecord = Omit<SessionState, 'schemaVersion' | 'history'> & {
  schemaVersion?: number
  history: SerializedCommandRecord[]
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function buildSessionState(snapshot: SessionSnapshot): SessionState {
  return {
    id: 'current-session',
    schemaVersion: SESSION_SCHEMA_VERSION,
    projectTitle: String(snapshot.projectTitle ?? ''),
    activeSourceIds: snapshot.activeSourceIds,
    pageMap: toPlain(snapshot.pageMap),
    history: toPlain(snapshot.history),
    historyPointer: snapshot.historyPointer,
    zoom: Number(snapshot.zoom),
    updatedAt: Date.now(),
    bookmarksTree: snapshot.bookmarksDirty ? toPlain(snapshot.bookmarksTree ?? []) : [],
    bookmarksDirty: Boolean(snapshot.bookmarksDirty),
    metadata: snapshot.metadata ? toPlain(snapshot.metadata) : undefined,
    security: snapshot.security ? toPlain(snapshot.security) : undefined,
    metadataDirty: Boolean(snapshot.metadataDirty),
  }
}

export function migrateSessionState(record: SessionStateRecord): SessionState {
  const schemaVersion =
    typeof record.schemaVersion === 'number' ? record.schemaVersion : SESSION_SCHEMA_VERSION

  const history = migrateSerializedCommands(record.history ?? [])

  switch (schemaVersion) {
    case SESSION_SCHEMA_VERSION:
      return {
        ...record,
        schemaVersion,
        history,
        bookmarksDirty: Boolean(record.bookmarksDirty),
        metadataDirty: Boolean(record.metadataDirty),
      }
    default:
      return {
        ...record,
        schemaVersion,
        history,
        bookmarksDirty: Boolean(record.bookmarksDirty),
        metadataDirty: Boolean(record.metadataDirty),
      }
  }
}

export async function persistSession(snapshot: SessionSnapshot): Promise<void> {
  const sessionData = buildSessionState(snapshot)
  await db.session.put(sessionData)
}

export async function loadSession(): Promise<SessionState | undefined> {
  const record = (await db.session.get('current-session')) as SessionStateRecord | undefined
  if (!record) return undefined

  const migrated = migrateSessionState(record)
  if (record.schemaVersion !== migrated.schemaVersion) {
    await db.session.put(migrated)
  }
  return migrated
}
