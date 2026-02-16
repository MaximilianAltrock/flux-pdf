import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { useHistoryStore } from '@/domains/history/store/history.store'
import { useSettingsStore } from './settings.store'
import { useThumbnailRenderer } from '@/domains/document/application/useThumbnailRenderer'
import type { ProjectMeta, ProjectState } from '@/shared/infrastructure/db'
import { evictPdfCache } from '@/domains/document/infrastructure/import'
import { createProjectAuthoringService } from '@/domains/workspace/application/project-authoring.service'
import type { GcStateSnapshot } from '@/domains/workspace/application/project-storage-gc'
import { createProjectAutosaveService } from '@/domains/workspace/application/project-autosave.service'
import { createProjectLifecycleService } from '@/domains/workspace/application/project-lifecycle.service'
import { createProjectPersistenceService } from '@/domains/workspace/application/project-persistence.service'
import { createProjectStateController } from '@/domains/workspace/application/project-state.service'
import { createProjectSourceGcService } from '@/domains/workspace/application/project-source-gc.service'
import { hydrateProjectWorkspace } from '@/domains/workspace/application/project-hydration.service'
import { createProjectThumbnailService } from '@/domains/workspace/application/project-thumbnail.service'
import {
  clampProjectGridZoom,
} from '@/domains/workspace/application/project-session.service'
import type { PageReference } from '@/shared/types'
import type { DocumentUiState } from '@/shared/types/ui'
import { STORAGE_KEYS } from '@/shared/constants'

export const useProjectsStore = defineStore('projects', () => {
  const store = useDocumentStore()
  const historyStore = useHistoryStore()
  const settingsStore = useSettingsStore()
  const { renderThumbnail, clearCache } = useThumbnailRenderer()
  const projectPersistence = createProjectPersistenceService()
  const projectAuthoring = createProjectAuthoringService(projectPersistence)
  const projectThumbnail = createProjectThumbnailService({ renderThumbnail })
  const sourceGc = createProjectSourceGcService(projectPersistence, {
    evictSourceCache: evictPdfCache,
  })
  const gcInFlight = sourceGc.isRunning

  const projectState = createProjectStateController(
    useLocalStorage<string | null>(
      STORAGE_KEYS.LAST_ACTIVE_PROJECT_ID,
      null,
    ),
  )
  const activeProjectId = projectState.activeProjectId
  const activeProjectMeta = projectState.activeProjectMeta
  const isHydrating = projectState.isHydrating
  const lastActiveProjectId = projectState.lastActiveProjectId
  const boundUiState = projectState.boundUiState

  function bindUiState(uiState?: DocumentUiState) {
    projectState.bindUiState(uiState)
  }

  function setLastActiveProjectId(id: string | null) {
    projectState.setLastActiveProjectId(id)
  }

  function getLastActiveProjectId(): string | null {
    return projectState.getLastActiveProjectId()
  }

  function getDefaultGridZoom(): number {
    return clampProjectGridZoom(settingsStore.preferences.defaultGridZoom)
  }

  function getLiveGcState(): GcStateSnapshot {
    return {
      activeSourceIds: Array.from(store.sources.keys()),
      pages: store.pages,
      history: historyStore.serializeHistory(),
    }
  }

  async function listRecentProjects(limit = 5): Promise<ProjectMeta[]> {
    return projectPersistence.listRecentProjects(limit)
  }

  async function listTrashedProjects(limit = 0): Promise<ProjectMeta[]> {
    return projectPersistence.listTrashedProjects(limit)
  }

  async function loadProjectMeta(id: string): Promise<ProjectMeta | undefined> {
    return projectPersistence.loadProjectMeta(id)
  }

  async function createProject(options?: { title?: string; open?: boolean }): Promise<ProjectMeta> {
    const meta = await projectAuthoring.createProject({
      title: options?.title,
      defaultAuthor: settingsStore.preferences.defaultAuthor,
      defaultGridZoom: getDefaultGridZoom(),
    })

    if (options?.open) {
      await switchProject(meta.id)
    }

    return meta
  }

  async function persistActiveProject(): Promise<void> {
    if (!activeProjectId.value) return
    const meta = await projectAuthoring.persistProject({
      projectId: activeProjectId.value,
      existingMeta: activeProjectMeta.value,
      projectTitle: store.projectTitle,
      contentPages: store.contentPages as PageReference[],
      contentPageCount: store.contentPageCount,
      snapshot: {
        activeSourceIds: Array.from(store.sources.keys()),
        pageMap: store.pages,
        history: historyStore.serializeHistory(),
        historyPointer: historyStore.getHistoryPointer(),
        zoom: boundUiState.value?.zoom.value ?? getDefaultGridZoom(),
        outlineTree: store.outlineTree,
        outlineDirty: store.outlineDirty,
        metadata: store.metadata,
        security: store.security,
        metadataDirty: store.metadataDirty,
        ignoredPreflightRuleIds: boundUiState.value?.ignoredPreflightRuleIds.value ?? [],
      },
      ensureThumbnail: projectThumbnail.ensureThumbnail,
    })

    if (meta) {
      activeProjectMeta.value = meta
    }
  }

  async function hydrateStore(meta: ProjectMeta, state: ProjectState): Promise<void> {
    const files = await projectPersistence.loadStoredFiles(state.activeSourceIds ?? [])
    hydrateProjectWorkspace({
      meta,
      state,
      files,
      documentStore: store,
      historyStore,
      uiState: boundUiState.value,
      defaultGridZoom: getDefaultGridZoom(),
      clearThumbnailCache: clearCache,
    })
  }

  const projectLifecycle = createProjectLifecycleService({
    persistence: projectPersistence,
    state: projectState.lifecycleState,
    hydrateStore,
    persistActiveProject,
    rememberThumbnailKey: projectThumbnail.rememberThumbnailKey,
    getLiveGcState,
    runGarbageCollection: sourceGc.run,
    setHydrating: projectState.setHydrating,
    setLoading: projectState.setLoading,
    onLoadError: (error) => {
      console.error('Failed to load project:', error)
    },
  })

  async function loadProject(id: string): Promise<boolean> {
    return projectLifecycle.loadProject(id)
  }

  async function switchProject(id: string): Promise<boolean> {
    return projectLifecycle.switchProject(id)
  }

  async function renameProject(id: string, title: string): Promise<void> {
    const updated = await projectPersistence.renameProject(id, title)
    if (!updated) return

    if (activeProjectId.value === id) {
      activeProjectMeta.value = updated
      store.setProjectTitle(updated.title)
    }
  }

  async function duplicateProject(id: string): Promise<ProjectMeta | null> {
    return projectPersistence.duplicateProject(id)
  }

  async function permanentlyDeleteProject(id: string): Promise<void> {
    await projectLifecycle.permanentlyDeleteProject(id)
  }

  async function trashProject(id: string): Promise<void> {
    await projectLifecycle.trashProject(id)
  }

  async function restoreProject(id: string): Promise<void> {
    await projectLifecycle.restoreProject(id)
  }

  async function deleteProject(id: string): Promise<void> {
    await permanentlyDeleteProject(id)
  }

  async function emptyTrash(): Promise<number> {
    return projectLifecycle.emptyTrash()
  }

  async function runGarbageCollection(): Promise<void> {
    await sourceGc.run()
  }

  const projectAutosave = createProjectAutosaveService({
    canPersist: () => Boolean(activeProjectId.value) && !isHydrating.value,
    persistProject: persistActiveProject,
    collectGarbage: sourceGc.run,
    getLiveGcState,
    // Version-driven autosave avoids expensive deep object walks.
    saveWatchSource: () => [
      store.pagesVersion,
      store.sourcesVersion,
      store.outlineVersion,
      store.metadataVersion,
      store.securityVersion,
      historyStore.historyPointer,
      historyStore.history.length,
      store.projectTitle,
      boundUiState.value?.zoom.value,
      store.outlineDirty,
      store.metadataDirty,
      boundUiState.value?.ignoredPreflightRuleIds.value,
    ],
    // GC only depends on source/page reachability and history shape.
    gcWatchSource: () => [store.pagesVersion, store.sourcesVersion, historyStore.history.length],
  })

  projectAutosave.start()

  return {
    activeProjectId,
    activeProjectMeta,
    isHydrating,
    lastActiveProjectId,
    boundUiState,
    gcInFlight,
    bindUiState,
    getLastActiveProjectId,
    listRecentProjects,
    listTrashedProjects,
    loadProjectMeta,
    createProject,
    persistActiveProject,
    loadProject,
    switchProject,
    renameProject,
    duplicateProject,
    trashProject,
    restoreProject,
    deleteProject,
    permanentlyDeleteProject,
    emptyTrash,
    runGarbageCollection,
    setLastActiveProjectId,
  }
})


