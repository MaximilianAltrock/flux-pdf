import { defineStore } from 'pinia'
import { useSettingsPreferencesState } from '@/domains/settings/application'
import { createProjectAuthoringService } from '@/domains/project-session/application/project-authoring.service'
import { createProjectPersistenceService } from '@/domains/project-session/application/project-persistence.service'
import {
  clampProjectGridZoom,
} from '@/domains/project-session/domain/project-snapshot'

export const useWorkspaceCatalogStore = defineStore('workspace-catalog', () => {
  const { preferences } = useSettingsPreferencesState()
  const projectPersistence = createProjectPersistenceService()
  const projectAuthoring = createProjectAuthoringService(projectPersistence)

  function getDefaultGridZoom(): number {
    return clampProjectGridZoom(preferences.value.defaultGridZoom)
  }

  async function createProject(options?: { title?: string }) {
    return projectAuthoring.createProject({
      title: options?.title,
      defaultAuthor: preferences.value.defaultAuthor,
      defaultGridZoom: getDefaultGridZoom(),
    })
  }

  async function renameProject(id: string, title: string): Promise<void> {
    await projectPersistence.renameProject(id, title)
  }

  async function duplicateProject(id: string) {
    return projectPersistence.duplicateProject(id)
  }

  async function permanentlyDeleteProject(id: string): Promise<void> {
    await projectPersistence.permanentlyDeleteProject(id)
  }

  async function trashProject(id: string): Promise<void> {
    await projectPersistence.trashProject(id)
  }

  async function restoreProject(id: string): Promise<void> {
    await projectPersistence.restoreProject(id)
  }

  async function emptyTrash(): Promise<number> {
    const deletedProjectIds = await projectPersistence.emptyTrash()
    return deletedProjectIds.length
  }

  return {
    listRecentProjects: projectPersistence.listRecentProjects,
    listTrashedProjects: projectPersistence.listTrashedProjects,
    loadProjectMeta: projectPersistence.loadProjectMeta,
    createProject,
    renameProject,
    duplicateProject,
    trashProject,
    restoreProject,
    permanentlyDeleteProject,
    emptyTrash,
  }
})
