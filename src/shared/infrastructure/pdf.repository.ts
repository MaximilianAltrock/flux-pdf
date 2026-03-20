import { getPdfBlob, getPdfDocument } from '@/domains/import/infrastructure/import'

export interface PdfRepository {
  getPdfDocument: typeof getPdfDocument
  getPdfBlob: typeof getPdfBlob
}

export function usePdfRepository(): PdfRepository {
  return {
    getPdfDocument,
    getPdfBlob,
  }
}
