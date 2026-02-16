import { db, type ProjectMeta, type ProjectState, type StoredFile } from '@/shared/infrastructure/db'
import { isProjectTrashed, normalizeProjectTitle } from './project-session.service'

export interface ProjectPersistenceRepository {
  listProjectsByUpdatedAtDesc: () => Promise<ProjectMeta[]>
  listAllProjects: () => Promise<ProjectMeta[]>
  listProjectStates: () => Promise<ProjectState[]>
  listStoredFileKeys: () => Promise<unknown[]>
  getStoredFilesByIds: (ids: string[]) => Promise<StoredFile[]>
  getProjectMeta: (id: string) => Promise<ProjectMeta | undefined>
  getProjectState: (id: string) => Promise<ProjectState | undefined>
  putProjectMeta: (meta: ProjectMeta) => Promise<void>
  putProjectState: (state: ProjectState) => Promise<void>
  deleteStoredFilesByIds: (ids: string[]) => Promise<void>
  deleteProjectMeta: (id: string) => Promise<void>
  deleteProjectState: (id: string) => Promise<void>
  deleteProjectsAndStates: (ids: string[]) => Promise<void>
}

export function createProjectPersistenceRepository(): ProjectPersistenceRepository {
  return {
    listProjectsByUpdatedAtDesc: async () => db.projects.orderBy('updatedAt').reverse().toArray(),
    listAllProjects: async () => db.projects.toArray(),
    listProjectStates: async () => db.states.toArray(),
    listStoredFileKeys: async () => db.files.toCollection().primaryKeys(),
    getStoredFilesByIds: async (ids) => {
      if (ids.length === 0) return []
      return db.files.where('id').anyOf(ids).toArray()
    },
    getProjectMeta: async (id) => db.projects.get(id),
    getProjectState: async (id) => db.states.get(id),
    putProjectMeta: async (meta) => {
      await db.projects.put(meta)
    },
    putProjectState: async (state) => {
      await db.states.put(state)
    },
    deleteStoredFilesByIds: async (ids) => {
      if (ids.length === 0) return
      await db.files.where('id').anyOf(ids).delete()
    },
    deleteProjectMeta: async (id) => {
      await db.projects.delete(id)
    },
    deleteProjectState: async (id) => {
      await db.states.delete(id)
    },
    deleteProjectsAndStates: async (ids) => {
      await db.transaction('rw', db.projects, db.states, async () => {
        await db.projects.where('id').anyOf(ids).delete()
        await db.states.where('id').anyOf(ids).delete()
      })
    },
  }
}

export interface ProjectBundle {
  meta: ProjectMeta | undefined
  state: ProjectState | undefined
}

function createProjectId(now = Date.now()): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `project-${now}`
}

export function createProjectPersistenceService(
  repository: ProjectPersistenceRepository = createProjectPersistenceRepository(),
) {
  async function listRecentProjects(limit = 5): Promise<ProjectMeta[]> {
    const allProjects = await repository.listProjectsByUpdatedAtDesc()
    const activeProjects = allProjects.filter((project) => !isProjectTrashed(project))
    if (limit) return activeProjects.slice(0, limit)
    return activeProjects
  }

  async function listTrashedProjects(limit = 0): Promise<ProjectMeta[]> {
    const allProjects = await repository.listAllProjects()
    const trashedProjects = allProjects
      .filter((project) => isProjectTrashed(project))
      .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
    if (limit) return trashedProjects.slice(0, limit)
    return trashedProjects
  }

  async function loadProjectMeta(id: string): Promise<ProjectMeta | undefined> {
    return repository.getProjectMeta(id)
  }

  async function loadProjectBundle(id: string): Promise<ProjectBundle> {
    const [meta, state] = await Promise.all([repository.getProjectMeta(id), repository.getProjectState(id)])
    return { meta, state }
  }

  async function listProjectStates(): Promise<ProjectState[]> {
    return repository.listProjectStates()
  }

  async function listStoredFileKeys(): Promise<unknown[]> {
    return repository.listStoredFileKeys()
  }

  async function loadStoredFiles(ids: string[]): Promise<StoredFile[]> {
    return repository.getStoredFilesByIds(ids)
  }

  async function deleteStoredFiles(ids: string[]): Promise<void> {
    await repository.deleteStoredFilesByIds(ids)
  }

  async function saveProjectRecord(meta: ProjectMeta, state: ProjectState): Promise<void> {
    await Promise.all([repository.putProjectMeta(meta), repository.putProjectState(state)])
  }

  async function renameProject(id: string, title: string): Promise<ProjectMeta | null> {
    const meta = await repository.getProjectMeta(id)
    if (!meta) return null

    const updated: ProjectMeta = {
      ...meta,
      title: normalizeProjectTitle(title),
      updatedAt: Date.now(),
    }
    await repository.putProjectMeta(updated)
    return updated
  }

  async function duplicateProject(id: string): Promise<ProjectMeta | null> {
    const { meta, state } = await loadProjectBundle(id)
    if (!meta || !state) return null

    const now = Date.now()
    const newId = createProjectId(now)
    const duplicateMeta: ProjectMeta = {
      ...meta,
      id: newId,
      title: `${meta.title} Copy`,
      updatedAt: now,
      createdAt: now,
      trashedAt: null,
    }
    const duplicateState: ProjectState = {
      ...state,
      id: newId,
      updatedAt: now,
    }

    await saveProjectRecord(duplicateMeta, duplicateState)
    return duplicateMeta
  }

  async function permanentlyDeleteProject(id: string): Promise<void> {
    await Promise.all([repository.deleteProjectMeta(id), repository.deleteProjectState(id)])
  }

  async function trashProject(id: string): Promise<ProjectMeta | null> {
    const meta = await repository.getProjectMeta(id)
    if (!meta || isProjectTrashed(meta)) return null

    const now = Date.now()
    const updated: ProjectMeta = {
      ...meta,
      trashedAt: now,
      updatedAt: now,
    }
    await repository.putProjectMeta(updated)
    return updated
  }

  async function restoreProject(id: string): Promise<ProjectMeta | null> {
    const meta = await repository.getProjectMeta(id)
    if (!meta || !isProjectTrashed(meta)) return null

    const updated: ProjectMeta = {
      ...meta,
      trashedAt: null,
      updatedAt: Date.now(),
    }
    await repository.putProjectMeta(updated)
    return updated
  }

  async function emptyTrash(): Promise<string[]> {
    const trashedProjects = await listTrashedProjects()
    if (trashedProjects.length === 0) return []

    const ids = trashedProjects.map((project) => project.id)
    await repository.deleteProjectsAndStates(ids)
    return ids
  }

  return {
    listRecentProjects,
    listTrashedProjects,
    listProjectStates,
    listStoredFileKeys,
    loadStoredFiles,
    deleteStoredFiles,
    loadProjectMeta,
    loadProjectBundle,
    saveProjectRecord,
    renameProject,
    duplicateProject,
    permanentlyDeleteProject,
    trashProject,
    restoreProject,
    emptyTrash,
  }
}
