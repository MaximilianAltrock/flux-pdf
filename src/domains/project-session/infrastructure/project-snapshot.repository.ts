import { db, type ProjectState, type StoredFile } from '@/shared/infrastructure/db'

export interface ProjectSnapshotRepository {
  listProjectStates(): Promise<ProjectState[]>
  listStoredFileKeys(): Promise<unknown[]>
  getStoredFilesByIds(ids: string[]): Promise<StoredFile[]>
  getProjectState(id: string): Promise<ProjectState | undefined>
  putProjectState(state: ProjectState): Promise<void>
  deleteStoredFilesByIds(ids: string[]): Promise<void>
  deleteProjectState(id: string): Promise<void>
  deleteProjectStates(ids: string[]): Promise<void>
}

export function createProjectSnapshotRepository(): ProjectSnapshotRepository {
  return {
    listProjectStates: async () => db.states.toArray(),
    listStoredFileKeys: async () => db.files.toCollection().primaryKeys(),
    getStoredFilesByIds: async (ids) => {
      if (ids.length === 0) return []
      return db.files.where('id').anyOf(ids).toArray()
    },
    getProjectState: async (id) => db.states.get(id),
    putProjectState: async (state) => {
      await db.states.put(state)
    },
    deleteStoredFilesByIds: async (ids) => {
      if (ids.length === 0) return
      await db.files.where('id').anyOf(ids).delete()
    },
    deleteProjectState: async (id) => {
      await db.states.delete(id)
    },
    deleteProjectStates: async (ids) => {
      if (ids.length === 0) return
      await db.states.where('id').anyOf(ids).delete()
    },
  }
}
