import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { CompressionQuality, CompressionResult } from '@/composables/usePdfCompression'
import type { StoredFile, ProjectMeta, ProjectState } from '@/db/db'
import type { FileUploadResult } from '@/types'
import type { LoadPdfFilesOptions } from './import'

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

export interface DocumentProjectAdapter {
  loadProjectMeta(id: string): Promise<ProjectMeta | undefined>
  loadProjectState(id: string): Promise<ProjectState | undefined>
  listProjectMeta(options?: { limit?: number }): Promise<ProjectMeta[]>
  listProjectStates(): Promise<ProjectState[]>
  persistProjectMeta(meta: ProjectMeta): Promise<void>
  persistProjectState(state: ProjectState): Promise<void>
  deleteProject(id: string): Promise<void>
  clearProjects(): Promise<void>
}

export interface DocumentStorageAdapter {
  loadStoredFilesByIds(ids: string[]): Promise<StoredFile[]>
  loadAllStoredFiles(): Promise<StoredFile[]>
  listStoredFileIds(): Promise<string[]>
  deleteStoredFilesByIds(ids: string[]): Promise<number>
  clearFiles(): Promise<void>
}

export interface DocumentCompressionAdapter {
  compressPdf(
    data: Uint8Array,
    options: { quality: CompressionQuality },
  ): Promise<CompressionResult>
}

export interface DocumentAdapters {
  import: DocumentImportAdapter
  project: DocumentProjectAdapter
  storage: DocumentStorageAdapter
  compression: DocumentCompressionAdapter
}

export interface DocumentAdaptersOverrides {
  import?: Partial<DocumentImportAdapter>
  project?: Partial<DocumentProjectAdapter>
  storage?: Partial<DocumentStorageAdapter>
  compression?: Partial<DocumentCompressionAdapter>
}
