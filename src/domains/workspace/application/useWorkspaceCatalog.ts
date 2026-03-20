import { useWorkspaceCatalogStore } from '@/domains/workspace/store/workspace-catalog.store'

export function useWorkspaceCatalog() {
  const catalogStore = useWorkspaceCatalogStore()

  return {
    listRecentProjects: catalogStore.listRecentProjects,
    listTrashedProjects: catalogStore.listTrashedProjects,
    loadProjectMeta: catalogStore.loadProjectMeta,
    createProject: catalogStore.createProject,
    renameProject: catalogStore.renameProject,
    duplicateProject: catalogStore.duplicateProject,
    trashProject: catalogStore.trashProject,
    restoreProject: catalogStore.restoreProject,
    permanentlyDeleteProject: catalogStore.permanentlyDeleteProject,
    emptyTrash: catalogStore.emptyTrash,
  }
}
