import Dexie, { type Table } from 'dexie'
import { SCHEMA_VERSION, ZOOM } from '@/constants'
import type { PageEntry, PdfOutlineNode, DocumentMetadata, SecurityMetadata } from '@/types'
import type { SerializedCommand } from '@/commands'
import { migrateLegacySessionState } from '@/domain/document/project'

/**
 * Session state stored in IndexedDB
 * Represents the current workspace state including history
 */
/**
 * Legacy session state stored in IndexedDB (v1).
 * Retained for schema migration to projects.
 */
export interface SessionState {
  /** Singleton ID - always 'current-session' */
  id: 'current-session'

  /** Schema version for session migrations */
  schemaVersion: number

  /** User's project title */
  projectTitle: string

  /** The whitelist of files actually visible in the sidebar */
  activeSourceIds: string[]

  /** Current page arrangement */
  pageMap: PageEntry[]

  /** Serialized command history */
  history: SerializedCommand[]

  /** Current position in history (-1 = beginning) */
  historyPointer: number

  /** Zoom level */
  zoom: number

  /** Last update timestamp */
  updatedAt: number

  /** Persisted bookmark tree (custom only) */
  bookmarksTree?: unknown[] // stored as plain JSON

  /** Whether user has customized bookmarks (stops auto-gen overwrite) */
  bookmarksDirty?: boolean

  /** Document metadata persisted with the session */
  metadata?: DocumentMetadata

  /** Security options persisted with the session */
  security?: SecurityMetadata

  /** Whether user has customized metadata (prevents auto-apply on import) */
  metadataDirty?: boolean
}

/**
 * Lightweight project metadata for dashboard listings.
 */
export interface ProjectMeta {
  /** Project ID (UUID) */
  id: string

  /** Project title */
  title: string

  /** Cached PNG thumbnail of the first page */
  thumbnail?: Blob

  /** Number of content pages */
  pageCount: number

  /** Last update timestamp */
  updatedAt: number

  /** Creation timestamp */
  createdAt: number
}

/**
 * Heavy project state loaded when opening the editor.
 */
export interface ProjectState {
  /** Project ID (matches ProjectMeta.id) */
  id: string

  /** Schema version for project migrations */
  schemaVersion: number

  /** The whitelist of files actually visible in the sidebar */
  activeSourceIds: string[]

  /** Current page arrangement */
  pageMap: PageEntry[]

  /** Serialized command history */
  history: SerializedCommand[]

  /** Current position in history (-1 = beginning) */
  historyPointer: number

  /** Zoom level */
  zoom: number

  /** Last update timestamp */
  updatedAt: number

  /** Persisted bookmark tree (custom only) */
  bookmarksTree?: unknown[] // stored as plain JSON

  /** Whether user has customized bookmarks (stops auto-gen overwrite) */
  bookmarksDirty?: boolean

  /** Document metadata persisted with the project */
  metadata?: DocumentMetadata

  /** Security options persisted with the project */
  security?: SecurityMetadata

  /** Whether user has customized metadata (prevents auto-apply on import) */
  metadataDirty?: boolean
}

/**
 * Source PDF file stored in IndexedDB
 * Contains the heavy binary data separate from metadata
 */
export interface StoredFile {
  /** Unique file identifier */
  id: string

  /** The PDF binary data */
  data: ArrayBuffer

  /** Original filename */
  filename: string

  /** File size in bytes */
  fileSize: number

  /** Number of pages in the PDF */
  pageCount: number

  /** Timestamp when file was added */
  addedAt: number

  /** Color assigned to this source for UI */
  color: string

  /** Optional outline extracted from the PDF */
  outline?: PdfOutlineNode[]

  /** Optional metadata extracted from the PDF */
  metadata?: DocumentMetadata
}

/**
 * FluxPDF IndexedDB Database
 *
 * Stores:
 * - projects: Lightweight metadata for dashboard
 * - states: Heavy per-project state
 * - files: Source PDF binary data (shared)
 */
export class FluxDatabase extends Dexie {
  session!: Table<SessionState>
  projects!: Table<ProjectMeta>
  states!: Table<ProjectState>
  files!: Table<StoredFile>

  constructor() {
    super('FluxPDF_DB')

    // Legacy schema (v1)
    this.version(1).stores({
      session: 'id', // Singleton - always 'current-session'
      files: 'id', // Source file ID
    })

    // Project-based schema (v2)
    this.version(SCHEMA_VERSION.DB)
      .stores({
        projects: 'id, updatedAt',
        states: 'id',
        files: 'id',
      })
      .upgrade(async (tx) => {
        const sessionTable = tx.table('session')
        const projectsTable = tx.table('projects')
        const statesTable = tx.table('states')

        const legacy = (await sessionTable.get('current-session')) as SessionState | undefined
        if (!legacy) return

        const migrated = migrateLegacySessionState(legacy)
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `project-${Date.now()}`

        const updatedAt = migrated.updatedAt ?? Date.now()
        const pageCount = (migrated.pageMap ?? []).filter((page) => !page.isDivider).length

        await projectsTable.add({
          id,
          title: migrated.projectTitle || 'Untitled Project',
          pageCount,
          updatedAt,
          createdAt: updatedAt,
        })

        await statesTable.add({
          id,
          schemaVersion: SCHEMA_VERSION.PROJECT,
          activeSourceIds: migrated.activeSourceIds ?? [],
          pageMap: migrated.pageMap ?? [],
          history: migrated.history ?? [],
          historyPointer: migrated.historyPointer ?? -1,
          zoom: migrated.zoom ?? ZOOM.DEFAULT,
          updatedAt,
          bookmarksTree: migrated.bookmarksTree,
          bookmarksDirty: migrated.bookmarksDirty,
          metadata: migrated.metadata,
          security: migrated.security,
          metadataDirty: migrated.metadataDirty,
        })
      })
  }
}

/** Global database instance */
export const db = new FluxDatabase()
