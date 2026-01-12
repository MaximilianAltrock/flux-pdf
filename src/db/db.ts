import Dexie, { type Table } from 'dexie'
import type { PageEntry, PdfOutlineNode, DocumentMetadata, SecurityMetadata } from '@/types'
import type { SerializedCommand } from '@/commands'

/**
 * Session state stored in IndexedDB
 * Represents the current workspace state including history
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
 * - session: Singleton containing workspace state and history
 * - files: Source PDF binary data
 */
export class FluxDatabase extends Dexie {
  session!: Table<SessionState>
  files!: Table<StoredFile>

  constructor() {
    super('FluxPDF_DB')

    this.version(1).stores({
      session: 'id', // Singleton - always 'current-session'
      files: 'id', // Source file ID
    })
  }
}

/** Global database instance */
export const db = new FluxDatabase()
