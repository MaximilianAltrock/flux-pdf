/**
 *
 * The Virtual Map architecture - we don't modify PDF binary data during editing.
 * Instead, we manipulate lightweight references.
 */

/**
 * Represents a raw PDF file loaded into the session.
 * The actual blob is stored in IndexedDB to prevent memory issues.
 */
export interface SourceFile {
  id: string
  filename: string
  pageCount: number
  /** Size in bytes */
  fileSize: number
  /** Timestamp when file was added */
  addedAt: number
  /** Color theme for this source (Tailwind color name) */
  color: string
  /** Optional outline extracted from the source PDF */
  outline?: PdfOutlineNode[]
  /** Optional metadata extracted from the source PDF */
  metadata?: DocumentMetadata
}

/**
 * Document-level metadata for export and session persistence.
 */
export interface DocumentMetadata {
  title: string
  author: string
  subject: string
  keywords: string[]
  pdfVersion?: '1.4' | '1.7' | '2.0' | 'PDF/A'
}

/**
 * Security options for export and session persistence.
 */
export interface SecurityMetadata {
  isEncrypted: boolean
  userPassword?: string
  ownerPassword?: string
  allowPrinting: boolean
  allowCopying: boolean
  allowModifying: boolean
}

/**
 * The atomic unit - a reference to a specific page in a source file.
 * This is what we manipulate in the UI grid.
 */
export interface PageReference {
  id: string
  sourceFileId: string
  sourcePageIndex: number // 0-based index in the original file
  rotation: 0 | 90 | 180 | 270

  // Grouping
  groupId?: string // specific group/batch ID, defaults to sourceFileId
  isDivider?: boolean
}

/**
 * Thumbnail cache entry
 */
export interface ThumbnailCacheEntry {
  pageRefId: string
  blobUrl: string
  /** Timestamp for LRU eviction */
  lastAccessed: number
}

/**
 * Render request sent to the Web Worker
 */
export interface RenderRequest {
  type: 'render'
  requestId: string
  sourceFileId: string
  pageIndex: number
  rotation: 0 | 90 | 180 | 270
  width: number
  height: number
}

/**
 * Render response from the Web Worker
 */
export interface RenderResponse {
  type: 'render-complete' | 'render-error'
  requestId: string
  blobUrl?: string
  error?: string
}

/**
 * Selection state for multi-select operations
 */
export interface SelectionState {
  selectedIds: Set<string>
  lastSelectedId: string | null
}

/**
 * UI bookmark node used by the Structure panel.
 */
export interface BookmarkNode {
  id: string
  title: string
  pageId: string
  children: BookmarkNode[]
  expanded: boolean
}

/**
 * Outline node extracted from a PDF (pageIndex is 0-based in the source file).
 */
export interface PdfOutlineNode {
  title: string
  pageIndex: number
  children?: PdfOutlineNode[]
}

/**
 * File upload result
 */
export interface FileUploadResult {
  success: boolean
  sourceFile?: SourceFile
  pageRefs?: PageReference[]
  error?: string
}
