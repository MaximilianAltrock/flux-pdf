import { db } from '@/db/db'
import { usePdfCompression } from '@/composables/usePdfCompression'
import { loadPdfFiles, getPdfDocument, getPdfBlob, clearPdfCache, evictPdfCache } from '../import'
import type {
  DocumentAdapters,
  DocumentAdaptersOverrides,
  DocumentCompressionAdapter,
  DocumentImportAdapter,
  DocumentProjectAdapter,
  DocumentStorageAdapter,
} from '../ports'

const defaultImportAdapter: DocumentImportAdapter = {
  loadPdfFiles,
  getPdfDocument,
  getPdfBlob,
  clearPdfCache,
  evictPdfCache,
}

const defaultProjectAdapter: DocumentProjectAdapter = {
  loadProjectMeta: (id) => db.projects.get(id),
  loadProjectState: (id) => db.states.get(id),
  listProjectMeta: async (options) => {
    if (options?.limit) {
      return db.projects.orderBy('updatedAt').reverse().limit(options.limit).toArray()
    }
    return db.projects.orderBy('updatedAt').reverse().toArray()
  },
  listProjectStates: () => db.states.toArray(),
  persistProjectMeta: (meta) => db.projects.put(meta),
  persistProjectState: (state) => db.states.put(state),
  deleteProject: async (id) => {
    await db.projects.delete(id)
    await db.states.delete(id)
  },
  clearProjects: async () => {
    await db.projects.clear()
    await db.states.clear()
  },
}

const defaultStorageAdapter: DocumentStorageAdapter = {
  loadStoredFilesByIds: (ids) => db.files.where('id').anyOf(ids).toArray(),
  loadAllStoredFiles: () => db.files.toArray(),
  listStoredFileIds: async () => {
    const keys = await db.files.toCollection().primaryKeys()
    return keys.map((key) => String(key))
  },
  deleteStoredFilesByIds: (ids) => {
    if (ids.length === 0) return Promise.resolve(0)
    return db.files.where('id').anyOf(ids).delete()
  },
  clearFiles: () => db.files.clear(),
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
    project: { ...defaultProjectAdapter, ...overrides.project },
    storage: { ...defaultStorageAdapter, ...overrides.storage },
    compression: { ...defaultCompressionAdapter, ...overrides.compression },
  }
}
