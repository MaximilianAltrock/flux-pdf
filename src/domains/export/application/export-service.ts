import type { Ref } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Result } from '@/shared/types/result'
import type { JobState } from '@/shared/types/jobs'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { CompressionOptions, CompressionResult } from '@/domains/export/application/usePdfCompression'
import type { PageReference } from '@/shared/types'
import type {
  ExportOptions,
  ExportResult,
  GeneratorOptions,
  parsePageRange,
  validatePageRange,
} from '@/domains/export/domain/export'
import type { PdfRepository } from '@/shared/infrastructure/pdf.repository'

export interface ExportUiBindings {
  setLoading?: (loading: boolean, message?: string) => void
  exportJob?: Ref<JobState>
}

export interface ExportServiceSettings {
  filenamePattern: Ref<string>
}

export interface ExportCompressionBindings {
  compressPdf: (data: Uint8Array, options?: CompressionOptions) => Promise<CompressionResult>
  dispose?: () => void
}

export interface ExportServiceDeps {
  documentStore: DocumentState
  pdfRepository: PdfRepository
  ui?: ExportUiBindings
  compression?: ExportCompressionBindings
  settings: ExportServiceSettings
}

export interface ExportService {
  exportDocument(options: ExportOptions): Promise<Result<ExportResult>>
  generateRawPdf(
    pages: PageReference[],
    options?: GeneratorOptions & { outline?: ExportOptions['outline'] },
  ): Promise<Result<Uint8Array>>
  clearExportError(): void
  getSuggestedFilename(): string
  getEstimatedSize(pagesToEstimate?: ReadonlyArray<PageReference>): number
  parsePageRange: typeof parsePageRange
  validatePageRange: typeof validatePageRange
  getPdfDocument(sourceFileId: string): Promise<PDFDocumentProxy>
  getPdfBlob(sourceFileId: string): Promise<ArrayBuffer | undefined>
  exportJob?: Ref<JobState>
  dispose(): void
}

export type { ExportOptions, ExportResult, GeneratorOptions }
