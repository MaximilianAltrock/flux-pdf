import { getPdfBlob, getPdfDocument } from '@/domains/document/infrastructure/import'

export function usePdfRepository() {
  return {
    getPdfDocument,
    getPdfBlob,
  }
}

