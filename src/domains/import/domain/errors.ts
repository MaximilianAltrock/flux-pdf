import {
  makeAppError,
  type AppError,
  type ImportErrorCode,
} from '@/shared/types/errors'

export type { ImportErrorCode } from '@/shared/types/errors'

export type ImportError = AppError<ImportErrorCode>

const IMPORT_MESSAGES: Record<ImportErrorCode, string> = {
  IMPORT_FAILED: 'Import failed',
  IMPORT_PDF_LOAD_FAILED: 'Failed to read the PDF file',
  IMPORT_IMAGE_CONVERSION_FAILED: 'Unsupported image format. Use JPG or PNG.',
}

export function getImportErrorMessage(code: ImportErrorCode, fallback?: string): string {
  return IMPORT_MESSAGES[code] ?? fallback ?? 'Import failed'
}

export function makeImportError(
  code: ImportErrorCode,
  message?: string,
  cause?: unknown,
): ImportError {
  return makeAppError(
    code,
    message ?? getImportErrorMessage(code),
    cause,
  )
}
