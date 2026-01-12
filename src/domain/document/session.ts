import { db, type SessionState } from '@/db/db'
import type { PageEntry, DocumentMetadata, SecurityMetadata } from '@/types'
import type { SerializedCommand } from '@/commands'

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

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function buildSessionState(snapshot: SessionSnapshot): SessionState {
  return {
    id: 'current-session',
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

export async function persistSession(snapshot: SessionSnapshot): Promise<void> {
  const sessionData = buildSessionState(snapshot)
  await db.session.put(sessionData)
}

export async function loadSession(): Promise<SessionState | undefined> {
  return db.session.get('current-session')
}
