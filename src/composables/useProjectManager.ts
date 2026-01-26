import { effectScope, ref, shallowRef, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { HISTORY, TIMEOUTS_MS, ZOOM } from '@/constants'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { createDocumentAdapters } from '@/domain/document/adapters'
import type { DocumentAdaptersOverrides } from '@/domain/document/ports'
import type { ProjectMeta, ProjectState } from '@/db/db'
import {
  buildProjectState,
  migrateProjectState,
  type ProjectSnapshot,
  type ProjectStateRecord,
} from '@/domain/document/project'
import { collectReachableSourceIdsFromState } from '@/domain/document/storage-gc'
import type { SerializedCommand } from '@/commands'
import type { BookmarkNode, DocumentMetadata, PageEntry, PageReference } from '@/types'
import type { DocumentUiState } from '@/composables/useDocumentService'

const LAST_ACTIVE_PROJECT_KEY = 'lastActiveProjectId'

const activeProjectId = ref<string | null>(null)
const activeProjectMeta = ref<ProjectMeta | null>(null)
const isHydrating = ref(false)
let autoSaveInitialized = false
const boundUiState = shallowRef<DocumentUiState | null>(null)
let activeAdapters = createDocumentAdapters()
const autoSaveScope = effectScope(true)

const thumbnailKeyByProject = new Map<string, string | null>()
const thumbnailInFlight = new Map<string, Promise<Blob | undefined>>()
const gcInFlight = ref(false)

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function setLastActiveProjectId(id: string | null) {
  const storage = getLocalStorage()
  if (!storage) return
  if (id) storage.setItem(LAST_ACTIVE_PROJECT_KEY, id)
  else storage.removeItem(LAST_ACTIVE_PROJECT_KEY)
}

function getLastActiveProjectId(): string | null {
  const storage = getLocalStorage()
  if (!storage) return null
  return storage.getItem(LAST_ACTIVE_PROJECT_KEY)
}

function normalizeTitle(title: string | undefined): string {
  const next = String(title ?? '').trim()
  return next.length > 0 ? next : 'Untitled Project'
}

function isDefaultMetadata(value: { title?: string; author?: string; subject?: string; keywords?: string[] }) {
  return (
    (value.title ?? '').trim() === 'Untitled Project' &&
    !(value.author ?? '').trim() &&
    !(value.subject ?? '').trim() &&
    (value.keywords ?? []).length === 0
  )
}

function coerceBookmarkTree(value: unknown): BookmarkNode[] {
  if (!Array.isArray(value)) return []
  return value as BookmarkNode[]
}

function getFirstPageReference(pages: ReadonlyArray<PageReference>): PageReference | null {
  for (const page of pages) {
    if (page && !page.isDivider) return page as PageReference
  }
  return null
}

function getThumbnailKey(page: PageReference | null): string | null {
  if (!page) return null
  return `${page.sourceFileId}-${page.sourcePageIndex}-${page.rotation}`
}

async function renderThumbnailBlob(page: PageReference | null): Promise<Blob | undefined> {
  if (!page) return undefined
  const { renderThumbnail } = useThumbnailRenderer()
  const url = await renderThumbnail(page)
  const response = await fetch(url)
  return response.blob()
}

async function ensureThumbnail(meta: ProjectMeta, page: PageReference | null): Promise<Blob | undefined> {
  const key = getThumbnailKey(page)
  const existingKey = thumbnailKeyByProject.get(meta.id) ?? null

  if (key && existingKey === key && meta.thumbnail) {
    return meta.thumbnail
  }

  if (!key) {
    thumbnailKeyByProject.set(meta.id, null)
    return undefined
  }

  if (thumbnailInFlight.has(key)) {
    return thumbnailInFlight.get(key)
  }

  const job = renderThumbnailBlob(page)
    .then((blob) => {
      if (blob) {
        thumbnailKeyByProject.set(meta.id, key)
      }
      return blob
    })
    .finally(() => {
      thumbnailInFlight.delete(key)
    })

  thumbnailInFlight.set(key, job)
  return job
}

type GcStateSnapshot = {
  activeSourceIds?: ReadonlyArray<string>
  pages: ReadonlyArray<PageEntry>
  history: ReadonlyArray<SerializedCommand>
}

async function garbageCollectStoredSources(
  adapters = activeAdapters,
  currentState?: GcStateSnapshot,
): Promise<void> {
  if (gcInFlight.value) return
  gcInFlight.value = true

  try {
    const states = await adapters.project.listProjectStates()
    const keepIds = new Set<string>()

    for (const state of states) {
      const ids = collectReachableSourceIdsFromState({
        activeSourceIds: state.activeSourceIds ?? [],
        pages: state.pageMap ?? [],
        history: state.history ?? [],
      })
      for (const id of ids) keepIds.add(id)
    }

    if (currentState) {
      const liveIds = collectReachableSourceIdsFromState({
        activeSourceIds: currentState.activeSourceIds ?? [],
        pages: currentState.pages,
        history: currentState.history,
      })
      for (const id of liveIds) keepIds.add(id)
    }

    const storedIds = await adapters.storage.listStoredFileIds()
    const orphanIds = storedIds.filter((id) => !keepIds.has(id))

    if (orphanIds.length === 0) return

    await adapters.storage.deleteStoredFilesByIds(orphanIds)
    adapters.import.evictPdfCache(orphanIds)
  } catch (error) {
    console.warn('Failed to garbage collect stored sources:', error)
  } finally {
    gcInFlight.value = false
  }
}

export function useProjectManager(
  overrides?: DocumentAdaptersOverrides,
  uiState?: DocumentUiState,
) {
  if (uiState) {
    boundUiState.value = uiState
  }
  const adapters = createDocumentAdapters(overrides)
  activeAdapters = adapters

  const store = useDocumentStore()
  const {
    serializeHistory,
    rehydrateHistory,
    getHistoryPointer,
    historyList,
    clearHistory,
  } = useCommandManager()
  const { clearCache } = useThumbnailRenderer()

  function setupAutoSave() {
    if (autoSaveInitialized) return
    autoSaveInitialized = true

    autoSaveScope.run(() => {
      const saveProject = useDebounceFn(async () => {
        if (!activeProjectId.value || isHydrating.value) return
        await persistActiveProject()
      }, TIMEOUTS_MS.SESSION_SAVE_DEBOUNCE)

      const scheduleGC = useDebounceFn(async () => {
        const liveState: GcStateSnapshot = {
          activeSourceIds: Array.from(store.sources.keys()),
          pages: store.pages,
          history: serializeHistory(),
        }
        await garbageCollectStoredSources(adapters, liveState)
      }, TIMEOUTS_MS.SESSION_SAVE_DEBOUNCE)

      const triggerSave = () => {
        saveProject()
        scheduleGC()
      }

      const watchTargets = [
        historyList,
        () => store.pages,
        () => store.projectTitle,
        () => store.sourceFileList,
        () => boundUiState.value?.zoom.value,
        () => store.bookmarksTree,
        () => store.bookmarksDirty,
        () => store.metadata,
        () => store.security,
        () => store.metadataDirty,
      ]

      for (const target of watchTargets) {
        // Pinia refs are reactive; we can watch with a deep flush using VueUse watchers
        watch(target, triggerSave, { deep: true })
      }
    })
  }

  async function listRecentProjects(limit = 5): Promise<ProjectMeta[]> {
    return adapters.project.listProjectMeta({ limit })
  }

  async function loadProjectMeta(id: string): Promise<ProjectMeta | undefined> {
    return adapters.project.loadProjectMeta(id)
  }

  async function createProject(options?: { title?: string; open?: boolean }): Promise<ProjectMeta> {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `project-${Date.now()}`
    const now = Date.now()
    const meta: ProjectMeta = {
      id,
      title: normalizeTitle(options?.title),
      pageCount: 0,
      updatedAt: now,
      createdAt: now,
    }

    const snapshot: ProjectSnapshot = {
      activeSourceIds: [],
      pageMap: [],
      history: [],
      historyPointer: HISTORY.POINTER_START,
      zoom: boundUiState.value?.zoom.value ?? ZOOM.DEFAULT,
      bookmarksTree: [],
      bookmarksDirty: false,
      metadata: undefined,
      security: undefined,
      metadataDirty: false,
    }

    const state = buildProjectState(id, snapshot)

    await adapters.project.persistProjectMeta(meta)
    await adapters.project.persistProjectState(state)

    if (options?.open) {
      await switchProject(id)
    }

    return meta
  }

  async function persistActiveProject(): Promise<void> {
    if (!activeProjectId.value) return

    const id = activeProjectId.value
    const existingMeta = activeProjectMeta.value ?? (await adapters.project.loadProjectMeta(id))
    if (!existingMeta) return

    const now = Date.now()
    const title = normalizeTitle(store.projectTitle)
    const firstPage = getFirstPageReference(store.contentPages as PageReference[])
    const thumbnail = await ensureThumbnail(existingMeta, firstPage)

    const meta: ProjectMeta = {
      ...existingMeta,
      title,
      pageCount: store.contentPageCount,
      updatedAt: now,
      thumbnail,
    }

    const snapshot: ProjectSnapshot = {
      activeSourceIds: Array.from(store.sources.keys()),
      pageMap: store.pages,
      history: serializeHistory(),
      historyPointer: getHistoryPointer(),
      zoom: boundUiState.value?.zoom.value ?? ZOOM.DEFAULT,
      bookmarksTree: store.bookmarksTree,
      bookmarksDirty: store.bookmarksDirty,
      metadata: store.metadata,
      security: store.security,
      metadataDirty: store.metadataDirty,
    }

    const state = buildProjectState(id, snapshot)
    state.updatedAt = now

    await adapters.project.persistProjectMeta(meta)
    await adapters.project.persistProjectState(state)

    activeProjectMeta.value = meta
  }

  async function hydrateStore(meta: ProjectMeta, state: ProjectState): Promise<void> {
    store.reset()
    clearHistory()
    clearCache()

    const files = await adapters.storage.loadStoredFilesByIds(state.activeSourceIds ?? [])
    for (const file of files) {
      store.addSourceFile({
        id: file.id,
        filename: file.filename,
        fileSize: file.fileSize,
        pageCount: file.pageCount,
        addedAt: file.addedAt,
        color: file.color,
        pageMetaData: file.pageMetaData ?? [],
        isImageSource: file.isImageSource ?? false,
        outline: file.outline,
        metadata: file.metadata,
      })
    }

    store.projectTitle = meta.title
    boundUiState.value?.setZoom(state.zoom ?? ZOOM.DEFAULT)
    store.bookmarksDirty = state.bookmarksDirty ?? false
    store.setPages(state.pageMap ?? [])

    if (state.metadata) {
      store.setMetadata(state.metadata, false)
    }

    store.metadataDirty =
      state.metadataDirty ??
      (state.metadata ? !isDefaultMetadata(state.metadata as DocumentMetadata) : false)

    if (state.security) {
      store.setSecurity(state.security)
    }

    if (store.bookmarksDirty) {
      const restoredTree = coerceBookmarkTree(state.bookmarksTree)
      store.setBookmarksTree(restoredTree, false)
    }

    rehydrateHistory(state.history ?? [], state.historyPointer ?? HISTORY.POINTER_START, state.updatedAt)
  }

  async function loadProject(id: string): Promise<boolean> {
    if (!id) return false
    isHydrating.value = true
    boundUiState.value?.setLoading(true, 'Loading project...')

    try {
      const [meta, rawState] = await Promise.all([
        adapters.project.loadProjectMeta(id),
        adapters.project.loadProjectState(id),
      ])
      if (!meta || !rawState) return false

      const migrated = migrateProjectState(rawState as ProjectStateRecord)
      if (rawState.schemaVersion !== migrated.schemaVersion) {
        await adapters.project.persistProjectState(migrated)
      }

      await hydrateStore(meta, migrated)
      activeProjectId.value = id
      activeProjectMeta.value = meta
      setLastActiveProjectId(id)

      const firstPage = getFirstPageReference(migrated.pageMap as PageReference[])
      thumbnailKeyByProject.set(id, getThumbnailKey(firstPage))
      const liveState: GcStateSnapshot = {
        activeSourceIds: Array.from(store.sources.keys()),
        pages: store.pages,
        history: serializeHistory(),
      }
      void garbageCollectStoredSources(adapters, liveState)
      return true
    } catch (error) {
      console.error('Failed to load project:', error)
      return false
    } finally {
      isHydrating.value = false
      boundUiState.value?.setLoading(false)
    }
  }

  async function switchProject(id: string): Promise<boolean> {
    if (!id) return false
    if (activeProjectId.value && activeProjectId.value !== id) {
      await persistActiveProject()
    }

    if (activeProjectId.value === id && activeProjectMeta.value) {
      return true
    }

    return loadProject(id)
  }

  async function renameProject(id: string, title: string): Promise<void> {
    const meta = await adapters.project.loadProjectMeta(id)
    if (!meta) return
    const updated: ProjectMeta = {
      ...meta,
      title: normalizeTitle(title),
      updatedAt: Date.now(),
    }
    await adapters.project.persistProjectMeta(updated)

    if (activeProjectId.value === id) {
      activeProjectMeta.value = updated
      store.projectTitle = updated.title
    }
  }

  async function duplicateProject(id: string): Promise<ProjectMeta | null> {
    const [meta, state] = await Promise.all([
      adapters.project.loadProjectMeta(id),
      adapters.project.loadProjectState(id),
    ])
    if (!meta || !state) return null

    const newId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `project-${Date.now()}`
    const now = Date.now()
    const duplicateMeta: ProjectMeta = {
      ...meta,
      id: newId,
      title: `${meta.title} Copy`,
      updatedAt: now,
      createdAt: now,
    }

    const duplicateState: ProjectState = {
      ...state,
      id: newId,
      updatedAt: now,
    }

    await adapters.project.persistProjectMeta(duplicateMeta)
    await adapters.project.persistProjectState(duplicateState)

    return duplicateMeta
  }

  async function deleteProject(id: string): Promise<void> {
    await adapters.project.deleteProject(id)
    if (activeProjectId.value === id) {
      activeProjectId.value = null
      activeProjectMeta.value = null
      setLastActiveProjectId(null)
    }
    if (getLastActiveProjectId() === id) {
      setLastActiveProjectId(null)
    }
    await garbageCollectStoredSources(adapters)
  }

  setupAutoSave()

  return {
    activeProjectId,
    activeProjectMeta,
    isHydrating,
    getLastActiveProjectId,
    listRecentProjects,
    loadProjectMeta,
    createProject,
    persistActiveProject,
    loadProject,
    switchProject,
    renameProject,
    duplicateProject,
    deleteProject,
    setLastActiveProjectId,
  }
}
