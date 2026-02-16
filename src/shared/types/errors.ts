import type { ResultError } from './result'

export const IMPORT_ERROR_CODES = [
  'IMPORT_FAILED',
  'IMPORT_PDF_LOAD_FAILED',
  'IMPORT_IMAGE_CONVERSION_FAILED',
] as const
export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number]

export const EXPORT_ERROR_CODES = [
  'EXPORT_NO_PAGES',
  'EXPORT_SOURCE_MISSING',
  'EXPORT_COMPRESSION_FAILED',
  'EXPORT_FAILED',
] as const
export type ExportErrorCode = (typeof EXPORT_ERROR_CODES)[number]

export type DocumentErrorCode = ImportErrorCode | ExportErrorCode

export const WORKFLOW_ERROR_CODES = [
  'WORKFLOW_INVALID',
  'WORKFLOW_NO_FILES',
  'WORKFLOW_RUN_FAILED',
] as const
export type WorkflowErrorCode = (typeof WORKFLOW_ERROR_CODES)[number]

export type AppErrorCode = DocumentErrorCode | WorkflowErrorCode
export type AppError<TCode extends string = AppErrorCode> = ResultError & {
  code: TCode
}

export function makeAppError<TCode extends string>(
  code: TCode,
  message: string,
  cause?: unknown,
): AppError<TCode> {
  return { code, message, cause }
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  )
}
