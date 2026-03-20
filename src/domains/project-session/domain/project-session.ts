import type { ProjectMeta } from '@/shared/infrastructure/db'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { HistorySession } from '@/domains/history/session/create-history-session'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { ImportOperationState } from '@/domains/import/session/import-operation.state'
import type { ExportOperationState } from '@/domains/export/session/export-operation.state'

export interface ProjectSessionLifecycle {
  activeProjectId: string | null
  activeProjectMeta: ProjectMeta | null
  isHydrating: boolean
  lastActiveProjectId: string | null
  gcInFlight: boolean
  getLastActiveProjectId(): string | null
  setLastActiveProjectId(id: string | null): void
  listRecentProjects(limit?: number): Promise<ProjectMeta[]>
  listTrashedProjects(limit?: number): Promise<ProjectMeta[]>
  loadProjectMeta(id: string): Promise<ProjectMeta | undefined>
  createProject(options?: { title?: string; open?: boolean }): Promise<ProjectMeta>
  persistActiveProject(): Promise<void>
  loadProject(id: string): Promise<boolean>
  switchProject(id: string): Promise<boolean>
  renameProject(id: string, title: string): Promise<void>
  duplicateProject(id: string): Promise<ProjectMeta | null>
  trashProject(id: string): Promise<void>
  restoreProject(id: string): Promise<void>
  deleteProject(id: string): Promise<void>
  permanentlyDeleteProject(id: string): Promise<void>
  emptyTrash(): Promise<number>
  runGarbageCollection(): Promise<void>
}

export interface ProjectSession {
  document: DocumentState
  history: HistorySession
  editor: EditorUiState
  importOperation: ImportOperationState
  exportOperation: ExportOperationState
  project: ProjectSessionLifecycle
  dispose(): void
}
