import { effectScope, reactive, toRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useSettingsPreferencesState } from '@/domains/settings/application'
import { createDocumentState } from '@/domains/project-session/session/document-state'
import { createHistorySession } from '@/domains/history/session/create-history-session'
import { createEditorUiState } from '@/domains/project-session/session/editor-ui.state'
import { createImportOperationState } from '@/domains/import/session/import-operation.state'
import { createExportOperationState } from '@/domains/export/session/export-operation.state'
import { useThumbnailRenderer } from '@/domains/document/application/composables/useThumbnailRenderer'
import { evictPdfCache } from '@/domains/import/infrastructure/import'
import { createProjectAuthoringService } from '@/domains/project-session/application/project-authoring.service'
import { createProjectAutosaveService } from '@/domains/project-session/application/project-autosave.service'
import {
  createProjectCatalogService,
  resolveProjectCatalogDefaults,
} from '@/domains/project-session/application/project-catalog.service'
import { hydrateProjectWorkspace } from '@/domains/project-session/application/project-hydration.service'
import { createProjectLifecycleService } from '@/domains/project-session/application/project-lifecycle.service'
import { createProjectPersistenceService } from '@/domains/project-session/application/project-persistence.service'
import { createProjectSourceGcService } from '@/domains/project-session/application/project-source-gc.service'
import { createProjectStateController } from '@/domains/project-session/session/project-state'
import { createProjectThumbnailService } from '@/domains/workspace/application'
import { STORAGE_KEYS } from '@/shared/constants'
import type { DocumentUiState } from '@/shared/types/ui'
import type { PageReference } from '@/shared/types'
import { createLogger } from '@/shared/infrastructure/logger'
import type { ProjectSession, ProjectSessionLifecycle } from '@/domains/project-session/domain/project-session'

export function createProjectSession(): ProjectSession {
  const scope = effectScope(true)
  const log = createLogger('project-session')

  const state = scope.run(() => {
    const { preferences } = useSettingsPreferencesState()
    const document = createDocumentState()
    const history = createHistorySession(document)
    const editor = createEditorUiState()
    const importOperation = createImportOperationState()
    const exportOperation = createExportOperationState()
    const { renderThumbnailBlob, clearCache } = useThumbnailRenderer()
    const projectPersistence = createProjectPersistenceService()
    const projectAuthoring = createProjectAuthoringService(projectPersistence)
    const projectCatalog = createProjectCatalogService({
      persistence: projectPersistence,
      authoring: projectAuthoring,
      getDefaults: () => resolveProjectCatalogDefaults(preferences.value),
    })
    const projectThumbnail = createProjectThumbnailService({ renderThumbnailBlob })
    const sourceGc = createProjectSourceGcService(projectPersistence, {
      evictSourceCache: evictPdfCache,
    })

    const projectState = createProjectStateController(
      useLocalStorage<string | null>(STORAGE_KEYS.LAST_ACTIVE_PROJECT_ID, null),
    )

    const uiState: DocumentUiState = {
      zoom: toRef(editor, 'zoom'),
      setZoom: editor.setZoom,
      setLoading: editor.setLoading,
      ignoredPreflightRuleIds: toRef(editor, 'ignoredPreflightRuleIds'),
      setIgnoredPreflightRuleIds: editor.setIgnoredPreflightRuleIds,
    }
    projectState.bindUiState(uiState)

    function buildLiveProjectSnapshot() {
      const activeSourceIds = Array.from(document.sources.keys())
      const serializedHistory = history.serializeHistory()
      const snapshot = {
        activeSourceIds,
        pageMap: document.pages,
        history: serializedHistory,
        historyPointer: history.getHistoryPointer(),
        zoom: editor.zoom,
        outlineTree: document.outlineTree,
        outlineDirty: document.outlineDirty,
        metadata: document.metadata,
        security: document.security,
        metadataDirty: document.metadataDirty,
        ignoredPreflightRuleIds: editor.ignoredPreflightRuleIds,
      }

      return {
        projectTitle: document.projectTitle,
        contentPages: document.contentPages as PageReference[],
        contentPageCount: document.contentPageCount,
        snapshot,
        gcState: {
          activeSourceIds,
          pages: document.pages,
          history: serializedHistory,
        },
      }
    }

    async function persistActiveProject(): Promise<void> {
      if (!projectState.activeProjectId.value) return
      await persistProjectFromSnapshot(buildLiveProjectSnapshot())
    }

    async function persistProjectFromSnapshot(
      liveSnapshot: ReturnType<typeof buildLiveProjectSnapshot>,
    ): Promise<void> {
      if (!projectState.activeProjectId.value) return
      const meta = await projectAuthoring.persistProject({
        projectId: projectState.activeProjectId.value,
        existingMeta: projectState.activeProjectMeta.value,
        projectTitle: liveSnapshot.projectTitle,
        contentPages: liveSnapshot.contentPages,
        contentPageCount: liveSnapshot.contentPageCount,
        snapshot: liveSnapshot.snapshot,
        ensureThumbnail: projectThumbnail.ensureThumbnail,
      })

      if (meta) {
        projectState.activeProjectMeta.value = meta
      }
    }

    async function hydrateStore(
      meta: NonNullable<typeof projectState.activeProjectMeta.value>,
      projectSnapshot: Parameters<typeof hydrateProjectWorkspace>[0]['state'],
      isCurrent: () => boolean,
    ): Promise<boolean> {
      const files = await projectPersistence.loadStoredFiles(projectSnapshot.activeSourceIds ?? [])
      if (!isCurrent()) return false

      hydrateProjectWorkspace({
        meta,
        state: projectSnapshot,
        files,
        documentStore: document,
        historyStore: history,
        uiState,
        defaultGridZoom: resolveProjectCatalogDefaults(preferences.value).defaultGridZoom,
        clearThumbnailCache: clearCache,
      })

      importOperation.resetImportJob()
      exportOperation.resetExportJob()
      exportOperation.closeExportModal()
      return true
    }

    const projectLifecycle = createProjectLifecycleService({
      persistence: projectPersistence,
      state: projectState.lifecycleState,
      hydrateStore,
      persistActiveProject,
      rememberThumbnailKey: projectThumbnail.rememberThumbnailKey,
      getLiveGcState: () => buildLiveProjectSnapshot().gcState,
      runGarbageCollection: sourceGc.run,
      setHydrating: projectState.setHydrating,
      setLoading: projectState.setLoading,
      onLoadError: (error) => {
        log.error('Failed to load project:', error)
      },
    })

    async function createProject(options?: {
      title?: string
      open?: boolean
    }) {
      const meta = await projectCatalog.createProject({
        title: options?.title,
      })

      if (options?.open) {
        await projectLifecycle.switchProject(meta.id)
      }

      return meta
    }

    async function renameProject(id: string, title: string): Promise<void> {
      const updated = await projectCatalog.renameProject(id, title)
      if (!updated) return

      if (projectState.activeProjectId.value === id) {
        projectState.activeProjectMeta.value = updated
        document.setProjectTitle(updated.title)
      }
    }

    async function duplicateProject(id: string) {
      return projectCatalog.duplicateProject(id)
    }

    async function runGarbageCollection() {
      await sourceGc.run(buildLiveProjectSnapshot().gcState)
    }

    const projectAutosave = createProjectAutosaveService({
      canPersist: () => Boolean(projectState.activeProjectId.value) && !projectState.isHydrating.value,
      buildSnapshot: buildLiveProjectSnapshot,
      persistProject: persistProjectFromSnapshot,
      collectGarbage: (liveSnapshot) => sourceGc.run(liveSnapshot.gcState),
      saveWatchSource: () => [
        document.pagesVersion,
        document.sourcesVersion,
        document.outlineVersion,
        document.metadataVersion,
        document.securityVersion,
        history.historyPointer,
        history.history.length,
        document.projectTitle,
        editor.zoom,
        document.outlineDirty,
        document.metadataDirty,
        editor.ignoredPreflightRuleIds,
      ],
      gcWatchSource: () => [
        document.pagesVersion,
        document.sourcesVersion,
        history.history.length,
      ],
    })
    projectAutosave.start()

    const project = reactive<ProjectSessionLifecycle>({
      get activeProjectId() {
        return projectState.activeProjectId.value ?? null
      },
      get activeProjectMeta() {
        return projectState.activeProjectMeta.value ?? null
      },
      get isHydrating() {
        return projectState.isHydrating.value ?? false
      },
      get lastActiveProjectId() {
        return projectState.lastActiveProjectId.value
      },
      get gcInFlight() {
        return sourceGc.isRunning.value ?? false
      },
      getLastActiveProjectId: projectState.getLastActiveProjectId,
      setLastActiveProjectId: projectState.setLastActiveProjectId,
      listRecentProjects: projectCatalog.listRecentProjects,
      listTrashedProjects: projectCatalog.listTrashedProjects,
      loadProjectMeta: projectCatalog.loadProjectMeta,
      createProject,
      persistActiveProject,
      loadProject: projectLifecycle.loadProject,
      switchProject: projectLifecycle.switchProject,
      renameProject,
      duplicateProject,
      trashProject: projectLifecycle.trashProject,
      restoreProject: projectLifecycle.restoreProject,
      deleteProject: projectLifecycle.permanentlyDeleteProject,
      permanentlyDeleteProject: projectLifecycle.permanentlyDeleteProject,
      emptyTrash: projectLifecycle.emptyTrash,
      runGarbageCollection,
    })

    return {
      document,
      history,
      editor,
      importOperation,
      exportOperation,
      project,
      stop() {
        projectAutosave.stop()
      },
    }
  })

  if (!state) {
    scope.stop()
    throw new Error('Failed to initialize project session')
  }

  return {
    document: state.document,
    history: state.history,
    editor: state.editor,
    importOperation: state.importOperation,
    exportOperation: state.exportOperation,
    project: state.project,
    dispose() {
      state.stop()
      scope.stop()
    },
  }
}
