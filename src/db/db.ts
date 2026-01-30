import Dexie, { type Table } from 'dexie'
import type {
  PageEntry,
  PdfOutlineNode,
  DocumentMetadata,
  SecurityMetadata,
  PageMetrics,
} from '@/types'
import type { SerializedCommand } from '@/commands'

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

  /** Persisted ignored preflight rule ids (per project) */
  ignoredPreflightRuleIds?: string[]
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
  /** Per-page metrics (index corresponds to pageIndex) */
  pageMetaData?: PageMetrics[]
  /** True when source was generated from an image import */
  isImageSource?: boolean

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
  projects!: Table<ProjectMeta>
  states!: Table<ProjectState>
  files!: Table<StoredFile>

  constructor() {
    super('FluxPDF_DB')

    this.version(1).stores({
      projects: 'id, updatedAt',
      states: 'id',
      files: 'id',
    })
  }
}

/** Global database instance */
export const db = new FluxDatabase()
