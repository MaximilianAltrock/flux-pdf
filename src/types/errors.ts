export type ImportErrorCode =
  | 'IMPORT_FAILED'
  | 'IMPORT_PDF_LOAD_FAILED'
  | 'IMPORT_IMAGE_CONVERSION_FAILED'

export type ExportErrorCode =
  | 'EXPORT_NO_PAGES'
  | 'EXPORT_SOURCE_MISSING'
  | 'EXPORT_COMPRESSION_FAILED'
  | 'EXPORT_FAILED'

export type DocumentErrorCode = ImportErrorCode | ExportErrorCode
