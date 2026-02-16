import {
  isAppError,
  makeAppError,
  type AppError,
  type DocumentErrorCode,
  type ExportErrorCode,
  type ImportErrorCode,
} from '@/shared/types/errors'

export type { DocumentErrorCode, ExportErrorCode, ImportErrorCode } from '@/shared/types/errors'

export type DocumentError = AppError<DocumentErrorCode>

const IMPORT_MESSAGES: Record<ImportErrorCode, string> = {
  IMPORT_FAILED: 'Import failed',
  IMPORT_PDF_LOAD_FAILED: 'Failed to read the PDF file',
  IMPORT_IMAGE_CONVERSION_FAILED: 'Unsupported image format. Use JPG or PNG.',
}

const EXPORT_MESSAGES: Record<ExportErrorCode, string> = {
  EXPORT_NO_PAGES: 'No pages to export',
  EXPORT_SOURCE_MISSING: 'A source file is missing',
  EXPORT_COMPRESSION_FAILED: 'Compression failed. Try exporting without compression.',
  EXPORT_FAILED: 'Export failed',
}

export function getImportErrorMessage(code: ImportErrorCode, fallback?: string): string {
  return IMPORT_MESSAGES[code] ?? fallback ?? 'Import failed'
}

export function getExportErrorMessage(code: ExportErrorCode, fallback?: string): string {
  return EXPORT_MESSAGES[code] ?? fallback ?? 'Export failed'
}

export function getDocumentErrorMessage(code: DocumentErrorCode, fallback?: string): string {
  if (code.startsWith('IMPORT_')) {
    return getImportErrorMessage(code as ImportErrorCode, fallback)
  }
  return getExportErrorMessage(code as ExportErrorCode, fallback)
}

export function makeDocumentError(
  code: DocumentErrorCode,
  message?: string,
  cause?: unknown,
): DocumentError {
  return makeAppError(
    code,
    message ?? getDocumentErrorMessage(code),
    cause,
  )
}

export function isDocumentError(error: unknown): error is DocumentError {
  if (!isAppError(error) || typeof error.code !== 'string') return false
  return error.code.startsWith('IMPORT_') || error.code.startsWith('EXPORT_')
}
