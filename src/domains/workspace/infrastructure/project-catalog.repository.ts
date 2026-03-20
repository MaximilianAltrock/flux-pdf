import { db, type ProjectMeta } from '@/shared/infrastructure/db'

export interface ProjectCatalogRepository {
  listProjectsByUpdatedAtDesc(): Promise<ProjectMeta[]>
  listAllProjects(): Promise<ProjectMeta[]>
  getProjectMeta(id: string): Promise<ProjectMeta | undefined>
  putProjectMeta(meta: ProjectMeta): Promise<void>
  deleteProjectMeta(id: string): Promise<void>
  deleteProjectMetas(ids: string[]): Promise<void>
}

export function createProjectCatalogRepository(): ProjectCatalogRepository {
  return {
    listProjectsByUpdatedAtDesc: async () => db.projects.orderBy('updatedAt').reverse().toArray(),
    listAllProjects: async () => db.projects.toArray(),
    getProjectMeta: async (id) => db.projects.get(id),
    putProjectMeta: async (meta) => {
      await db.projects.put(meta)
    },
    deleteProjectMeta: async (id) => {
      await db.projects.delete(id)
    },
    deleteProjectMetas: async (ids) => {
      if (ids.length === 0) return
      await db.projects.where('id').anyOf(ids).delete()
    },
  }
}
