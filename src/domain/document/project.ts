import type { PageEntry, DocumentMetadata, SecurityMetadata } from '@/types'
import type { SerializedCommand } from '@/commands'
import type { ProjectState } from '@/db/db'

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
  ignoredPreflightRuleIds?: string[]
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function buildProjectState(id: string, snapshot: ProjectSnapshot): ProjectState {
  return {
    id,
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
    ignoredPreflightRuleIds: toPlain(snapshot.ignoredPreflightRuleIds ?? []),
  }
}
