import { SCHEMA_VERSION } from '@/constants'
import type { PageEntry, DocumentMetadata, SecurityMetadata } from '@/types'
import type { SerializedCommand } from '@/commands'
import { migrateSerializedCommands, type SerializedCommandRecord } from '@/commands/migrations'
import type { ProjectState, SessionState } from '@/db/db'

export interface ProjectSnapshot {
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

export const PROJECT_SCHEMA_VERSION = SCHEMA_VERSION.PROJECT

export type ProjectStateRecord = Omit<ProjectState, 'schemaVersion' | 'history'> & {
  schemaVersion?: number
  history: SerializedCommandRecord[]
}

export type LegacySessionStateRecord = Omit<SessionState, 'schemaVersion' | 'history'> & {
  schemaVersion?: number
  history: SerializedCommandRecord[]
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function buildProjectState(id: string, snapshot: ProjectSnapshot): ProjectState {
  return {
    id,
    schemaVersion: PROJECT_SCHEMA_VERSION,
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

export function migrateProjectState(record: ProjectStateRecord): ProjectState {
  const schemaVersion =
    typeof record.schemaVersion === 'number' ? record.schemaVersion : PROJECT_SCHEMA_VERSION

  const history = migrateSerializedCommands(record.history ?? [])

  switch (schemaVersion) {
    case PROJECT_SCHEMA_VERSION:
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

export function migrateLegacySessionState(record: LegacySessionStateRecord): SessionState {
  const schemaVersion =
    typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION.SESSION

  const history = migrateSerializedCommands(record.history ?? [])

  switch (schemaVersion) {
    case SCHEMA_VERSION.SESSION:
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
