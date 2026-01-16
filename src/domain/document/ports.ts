import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { CompressionQuality, CompressionResult } from '@/composables/usePdfCompression'
import type { StoredFile, SessionState } from '@/db/db'
import type { FileUploadResult } from '@/types'
import type { LoadPdfFilesOptions } from './import'
import type { SessionSnapshot } from './session'

export interface DocumentImportAdapter {
  loadPdfFiles(
    files: FileList | File[],
    options?: LoadPdfFilesOptions,
  ): Promise<FileUploadResult[]>
  getPdfDocument(sourceFileId: string): Promise<PDFDocumentProxy>
  getPdfBlob(sourceFileId: string): Promise<ArrayBuffer | undefined>
  clearPdfCache(): void
  evictPdfCache(sourceFileIds: string[]): void
}

export interface DocumentSessionAdapter {
  persistSession(snapshot: SessionSnapshot): Promise<void>
  loadSession(): Promise<SessionState | undefined>
}

export interface DocumentStorageAdapter {
  loadStoredFilesByIds(ids: string[]): Promise<StoredFile[]>
  loadAllStoredFiles(): Promise<StoredFile[]>
  listStoredFileIds(): Promise<string[]>
  deleteStoredFilesByIds(ids: string[]): Promise<number>
  clearFiles(): Promise<void>
  clearSession(): Promise<void>
}

export interface DocumentCompressionAdapter {
  compressPdf(
    data: Uint8Array,
    options: { quality: CompressionQuality },
  ): Promise<CompressionResult>
}

export interface DocumentAdapters {
  import: DocumentImportAdapter
  session: DocumentSessionAdapter
  storage: DocumentStorageAdapter
  compression: DocumentCompressionAdapter
}

export interface DocumentAdaptersOverrides {
  import?: Partial<DocumentImportAdapter>
  session?: Partial<DocumentSessionAdapter>
  storage?: Partial<DocumentStorageAdapter>
  compression?: Partial<DocumentCompressionAdapter>
}
