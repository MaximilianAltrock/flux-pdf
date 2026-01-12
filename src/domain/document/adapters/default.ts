import { db } from '@/db/db'
import { usePdfCompression } from '@/composables/usePdfCompression'
import { loadPdfFiles, getPdfDocument, getPdfBlob, clearPdfCache } from '../import'
import { loadSession, persistSession } from '../session'
import type {
  DocumentAdapters,
  DocumentAdaptersOverrides,
  DocumentCompressionAdapter,
  DocumentImportAdapter,
  DocumentSessionAdapter,
  DocumentStorageAdapter,
} from '../ports'

const defaultImportAdapter: DocumentImportAdapter = {
  loadPdfFiles,
  getPdfDocument,
  getPdfBlob,
  clearPdfCache,
}

const defaultSessionAdapter: DocumentSessionAdapter = {
  persistSession,
  loadSession,
}

const defaultStorageAdapter: DocumentStorageAdapter = {
  loadStoredFilesByIds: (ids) => db.files.where('id').anyOf(ids).toArray(),
  loadAllStoredFiles: () => db.files.toArray(),
  clearFiles: () => db.files.clear(),
  clearSession: () => db.session.clear(),
}

const defaultCompressionAdapter: DocumentCompressionAdapter = {
  compressPdf: async (data, options) => {
    const { compressPdf } = usePdfCompression()
    return compressPdf(data, options)
  },
}

export function createDocumentAdapters(
  overrides: DocumentAdaptersOverrides = {},
): DocumentAdapters {
  return {
    import: { ...defaultImportAdapter, ...overrides.import },
    session: { ...defaultSessionAdapter, ...overrides.session },
    storage: { ...defaultStorageAdapter, ...overrides.storage },
    compression: { ...defaultCompressionAdapter, ...overrides.compression },
  }
}
