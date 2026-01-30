import { getPdfBlob, getPdfDocument } from '@/domain/document/import'

export function usePdfRepository() {
  return {
    getPdfDocument,
    getPdfBlob,
  }
}
