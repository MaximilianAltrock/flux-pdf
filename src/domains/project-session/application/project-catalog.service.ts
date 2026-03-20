import { ZOOM } from '@/shared/constants'
import { clampProjectGridZoom } from '@/domains/project-session/domain/project-snapshot'
import { createProjectAuthoringService } from '@/domains/project-session/application/project-authoring.service'
import { createProjectPersistenceService } from '@/domains/project-session/application/project-persistence.service'

export interface ProjectCatalogPreferences {
  defaultAuthor: string
  defaultGridZoom: number
}

export interface ProjectCatalogDefaults {
  defaultAuthor: string
  defaultGridZoom: number
}

export interface CreateProjectCatalogInput {
  title?: string
}

export interface CreateProjectCatalogServiceOptions {
  persistence?: ReturnType<typeof createProjectPersistenceService>
  authoring?: ReturnType<typeof createProjectAuthoringService>
  getDefaults?: () => ProjectCatalogDefaults
}

export function resolveProjectCatalogDefaults(
  preferences?: Partial<ProjectCatalogPreferences> | null,
): ProjectCatalogDefaults {
  return {
    defaultAuthor: typeof preferences?.defaultAuthor === 'string' ? preferences.defaultAuthor : '',
    defaultGridZoom: clampProjectGridZoom(
      typeof preferences?.defaultGridZoom === 'number'
        ? preferences.defaultGridZoom
        : ZOOM.DEFAULT,
    ),
  }
}

export function createProjectCatalogService(options: CreateProjectCatalogServiceOptions = {}) {
  const persistence = options.persistence ?? createProjectPersistenceService()
  const authoring = options.authoring ?? createProjectAuthoringService(persistence)
  const getDefaults = options.getDefaults ?? (() => resolveProjectCatalogDefaults())

  async function createProject(input?: CreateProjectCatalogInput) {
    const defaults = getDefaults()
    return authoring.createProject({
      title: input?.title,
      defaultAuthor: defaults.defaultAuthor,
      defaultGridZoom: defaults.defaultGridZoom,
    })
  }

  async function emptyTrash(): Promise<number> {
    return (await persistence.emptyTrash()).length
  }

  return {
    listRecentProjects: persistence.listRecentProjects,
    listTrashedProjects: persistence.listTrashedProjects,
    loadProjectMeta: persistence.loadProjectMeta,
    createProject,
    renameProject: persistence.renameProject,
    duplicateProject: persistence.duplicateProject,
    trashProject: persistence.trashProject,
    restoreProject: persistence.restoreProject,
    permanentlyDeleteProject: persistence.permanentlyDeleteProject,
    emptyTrash,
  }
}

export type ProjectCatalogService = ReturnType<typeof createProjectCatalogService>
