import {
  isAppError,
  makeAppError,
  type AppError,
  type ExportErrorCode,
} from '@/shared/types/errors'

export type { ExportErrorCode } from '@/shared/types/errors'

export type ExportError = AppError<ExportErrorCode>

const EXPORT_MESSAGES: Record<ExportErrorCode, string> = {
  EXPORT_NO_PAGES: 'No pages to export',
  EXPORT_SOURCE_MISSING: 'A source file is missing',
  EXPORT_COMPRESSION_FAILED: 'Compression failed. Try exporting without compression.',
  EXPORT_FAILED: 'Export failed',
}

export function getExportErrorMessage(code: ExportErrorCode, fallback?: string): string {
  return EXPORT_MESSAGES[code] ?? fallback ?? 'Export failed'
}

export function makeExportError(
  code: ExportErrorCode,
  message?: string,
  cause?: unknown,
): ExportError {
  return makeAppError(
    code,
    message ?? getExportErrorMessage(code),
    cause,
  )
}

export function isExportError(error: unknown): error is ExportError {
  return Boolean(isAppError(error) && typeof error.code === 'string' && error.code.startsWith('EXPORT_'))
}
