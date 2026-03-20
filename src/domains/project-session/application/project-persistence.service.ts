import type { ProjectMeta, ProjectState, StoredFile } from '@/shared/infrastructure/db'
import {
  createProjectSnapshotRepository,
  type ProjectSnapshotRepository,
} from '@/domains/project-session/infrastructure/project-snapshot.repository'
import {
  isProjectTrashed,
  normalizeProjectTitle,
} from '@/domains/project-session/domain/project-snapshot'
import {
  createProjectCatalogRepository,
  type ProjectCatalogRepository,
} from '@/domains/workspace/infrastructure/project-catalog.repository'

export interface ProjectBundle {
  meta: ProjectMeta | undefined
  state: ProjectState | undefined
}

export interface ProjectPersistenceRepository {
  listProjectsByUpdatedAtDesc(): Promise<ProjectMeta[]>
  listAllProjects(): Promise<ProjectMeta[]>
  listProjectStates(): Promise<ProjectState[]>
  listStoredFileKeys(): Promise<unknown[]>
  getStoredFilesByIds(ids: string[]): Promise<StoredFile[]>
  getProjectMeta(id: string): Promise<ProjectMeta | undefined>
  getProjectState(id: string): Promise<ProjectState | undefined>
  putProjectMeta(meta: ProjectMeta): Promise<void>
  putProjectState(state: ProjectState): Promise<void>
  deleteStoredFilesByIds(ids: string[]): Promise<void>
  deleteProjectMeta(id: string): Promise<void>
  deleteProjectState(id: string): Promise<void>
  deleteProjectsAndStates(ids: string[]): Promise<void>
}

export interface ProjectPersistenceRepositories {
  catalog: ProjectCatalogRepository
  snapshot: ProjectSnapshotRepository
}

type ProjectPersistenceInput = ProjectPersistenceRepositories | ProjectPersistenceRepository

function isLegacyRepository(value: ProjectPersistenceInput): value is ProjectPersistenceRepository {
  return 'listProjectsByUpdatedAtDesc' in value
}

function resolveRepositories(input: ProjectPersistenceInput): ProjectPersistenceRepositories {
  if (!isLegacyRepository(input)) {
    return input
  }

  return {
    catalog: {
      listProjectsByUpdatedAtDesc: input.listProjectsByUpdatedAtDesc,
      listAllProjects: input.listAllProjects,
      getProjectMeta: input.getProjectMeta,
      putProjectMeta: input.putProjectMeta,
      deleteProjectMeta: input.deleteProjectMeta,
      deleteProjectMetas: input.deleteProjectsAndStates,
    },
    snapshot: {
      listProjectStates: input.listProjectStates,
      listStoredFileKeys: input.listStoredFileKeys,
      getStoredFilesByIds: input.getStoredFilesByIds,
      getProjectState: input.getProjectState,
      putProjectState: input.putProjectState,
      deleteStoredFilesByIds: input.deleteStoredFilesByIds,
      deleteProjectState: input.deleteProjectState,
      deleteProjectStates: input.deleteProjectsAndStates,
    },
  }
}

function createProjectId(now = Date.now()): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `project-${now}`
}

export function createProjectPersistenceService(
  input: ProjectPersistenceInput = {
    catalog: createProjectCatalogRepository(),
    snapshot: createProjectSnapshotRepository(),
  },
) {
  const repositories = resolveRepositories(input)

  async function listRecentProjects(limit = 5): Promise<ProjectMeta[]> {
    const allProjects = await repositories.catalog.listProjectsByUpdatedAtDesc()
    const activeProjects = allProjects.filter((project) => !isProjectTrashed(project))
    if (limit) return activeProjects.slice(0, limit)
    return activeProjects
  }

  async function listTrashedProjects(limit = 0): Promise<ProjectMeta[]> {
    const allProjects = await repositories.catalog.listAllProjects()
    const trashedProjects = allProjects
      .filter((project) => isProjectTrashed(project))
      .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
    if (limit) return trashedProjects.slice(0, limit)
    return trashedProjects
  }

  async function loadProjectMeta(id: string): Promise<ProjectMeta | undefined> {
    return repositories.catalog.getProjectMeta(id)
  }

  async function loadProjectBundle(id: string): Promise<ProjectBundle> {
    const [meta, state] = await Promise.all([
      repositories.catalog.getProjectMeta(id),
      repositories.snapshot.getProjectState(id),
    ])
    return { meta, state }
  }

  async function listProjectStates(): Promise<ProjectState[]> {
    return repositories.snapshot.listProjectStates()
  }

  async function listStoredFileKeys(): Promise<unknown[]> {
    return repositories.snapshot.listStoredFileKeys()
  }

  async function loadStoredFiles(ids: string[]): Promise<StoredFile[]> {
    return repositories.snapshot.getStoredFilesByIds(ids)
  }

  async function deleteStoredFiles(ids: string[]): Promise<void> {
    await repositories.snapshot.deleteStoredFilesByIds(ids)
  }

  async function saveProjectRecord(meta: ProjectMeta, state: ProjectState): Promise<void> {
    await Promise.all([
      repositories.catalog.putProjectMeta(meta),
      repositories.snapshot.putProjectState(state),
    ])
  }

  async function renameProject(id: string, title: string): Promise<ProjectMeta | null> {
    const meta = await repositories.catalog.getProjectMeta(id)
    if (!meta) return null

    const updated: ProjectMeta = {
      ...meta,
      title: normalizeProjectTitle(title),
      updatedAt: Date.now(),
    }
    await repositories.catalog.putProjectMeta(updated)
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
    await Promise.all([
      repositories.catalog.deleteProjectMeta(id),
      repositories.snapshot.deleteProjectState(id),
    ])
  }

  async function trashProject(id: string): Promise<ProjectMeta | null> {
    const meta = await repositories.catalog.getProjectMeta(id)
    if (!meta || isProjectTrashed(meta)) return null

    const now = Date.now()
    const updated: ProjectMeta = {
      ...meta,
      trashedAt: now,
      updatedAt: now,
    }
    await repositories.catalog.putProjectMeta(updated)
    return updated
  }

  async function restoreProject(id: string): Promise<ProjectMeta | null> {
    const meta = await repositories.catalog.getProjectMeta(id)
    if (!meta || !isProjectTrashed(meta)) return null

    const updated: ProjectMeta = {
      ...meta,
      trashedAt: null,
      updatedAt: Date.now(),
    }
    await repositories.catalog.putProjectMeta(updated)
    return updated
  }

  async function emptyTrash(): Promise<string[]> {
    const trashedProjects = await listTrashedProjects()
    if (trashedProjects.length === 0) return []

    const ids = trashedProjects.map((project) => project.id)
    await Promise.all([
      repositories.catalog.deleteProjectMetas(ids),
      repositories.snapshot.deleteProjectStates(ids),
    ])
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
