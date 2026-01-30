import { defineStore } from 'pinia'
import { effectScope, ref, shallowRef, watch } from 'vue'
import { useDebounceFn, useLocalStorage } from '@vueuse/core'
import { HISTORY, TIMEOUTS_MS, ZOOM } from '@/constants'
import { useDocumentStore } from '@/stores/document'
import { useHistoryStore } from '@/stores/history'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { db, type ProjectMeta, type ProjectState } from '@/db/db'
import { buildProjectState, type ProjectSnapshot } from '@/domain/document/project'
import { evictPdfCache } from '@/domain/document/import'
import { collectReachableSourceIdsFromState } from '@/domain/document/storage-gc'
import type { SerializedCommand } from '@/commands'
import type { BookmarkNode, DocumentMetadata, PageEntry, PageReference } from '@/types'
import type { DocumentUiState } from '@/types/ui'

const LAST_ACTIVE_PROJECT_KEY = 'lastActiveProjectId'

function normalizeTitle(title: string | undefined): string {
  const next = String(title ?? '').trim()
  return next.length > 0 ? next : 'Untitled Project'
}

function isDefaultMetadata(value: {
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
}) {
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

async function ensureThumbnail(
  meta: ProjectMeta,
  page: PageReference | null,
  thumbnailKeyByProject: Map<string, string | null>,
  thumbnailInFlight: Map<string, Promise<Blob | undefined>>,
): Promise<Blob | undefined> {
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

export const useProjectsStore = defineStore('projects', () => {
  const store = useDocumentStore()
  const historyStore = useHistoryStore()
  const { clearCache } = useThumbnailRenderer()

  const activeProjectId = shallowRef<string | null>(null)
  const activeProjectMeta = ref<ProjectMeta | null>(null)
  const isHydrating = shallowRef(false)
  const lastActiveProjectId = useLocalStorage<string | null>(LAST_ACTIVE_PROJECT_KEY, null)
  const boundUiState = shallowRef<DocumentUiState | null>(null)

  let autoSaveInitialized = false
  const autoSaveScope = effectScope(true)

  const thumbnailKeyByProject = new Map<string, string | null>()
  const thumbnailInFlight = new Map<string, Promise<Blob | undefined>>()
  const gcInFlight = shallowRef(false)

  function bindUiState(uiState?: DocumentUiState) {
    if (uiState) boundUiState.value = uiState
  }

  function setLastActiveProjectId(id: string | null) {
    lastActiveProjectId.value = id
  }

  function getLastActiveProjectId(): string | null {
    return lastActiveProjectId.value
  }

  async function garbageCollectStoredSources(currentState?: GcStateSnapshot): Promise<void> {
    if (gcInFlight.value) return
    gcInFlight.value = true

    try {
      const states = await db.states.toArray()
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

      const storedKeys = await db.files.toCollection().primaryKeys()
      const storedIds = storedKeys.map((key) => String(key))
      const orphanIds = storedIds.filter((id) => !keepIds.has(id))

      if (orphanIds.length === 0) return

      await db.files.where('id').anyOf(orphanIds).delete()
      evictPdfCache(orphanIds)
    } catch (error) {
      console.warn('Failed to garbage collect stored sources:', error)
    } finally {
      gcInFlight.value = false
    }
  }

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
          history: historyStore.serializeHistory(),
        }
        await garbageCollectStoredSources(liveState)
      }, TIMEOUTS_MS.SESSION_SAVE_DEBOUNCE)

      const triggerSave = () => {
        saveProject()
        scheduleGC()
      }

      // Deep watch only for structures that mutate in place.
      const deepWatchSource = () => [
        store.pages,
        store.sourceFileList,
        store.bookmarksTree,
        store.metadata,
      ]

      watch(deepWatchSource, triggerSave, { deep: true })

      // Shallow watch for simple values or replaced objects.
      const shallowWatchSource = () => [
        historyStore.historyPointer,
        historyStore.history.length,
        store.projectTitle,
        boundUiState.value?.zoom.value,
        store.bookmarksDirty,
        store.metadataDirty,
        store.security,
        boundUiState.value?.ignoredPreflightRuleIds.value,
      ]

      watch(shallowWatchSource, triggerSave)
    })
  }

  async function listRecentProjects(limit = 5): Promise<ProjectMeta[]> {
    if (limit) {
      return db.projects.orderBy('updatedAt').reverse().limit(limit).toArray()
    }
    return db.projects.orderBy('updatedAt').reverse().toArray()
  }

  async function loadProjectMeta(id: string): Promise<ProjectMeta | undefined> {
    return db.projects.get(id)
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
      ignoredPreflightRuleIds: [],
    }

    const state = buildProjectState(id, snapshot)

    await db.projects.put(meta)
    await db.states.put(state)

    if (options?.open) {
      await switchProject(id)
    }

    return meta
  }

  async function persistActiveProject(): Promise<void> {
    if (!activeProjectId.value) return

    const id = activeProjectId.value
    const existingMeta = activeProjectMeta.value ?? (await db.projects.get(id))
    if (!existingMeta) return

    const now = Date.now()
    const title = normalizeTitle(store.projectTitle)
    const firstPage = getFirstPageReference(store.contentPages as PageReference[])
    const thumbnail = await ensureThumbnail(
      existingMeta,
      firstPage,
      thumbnailKeyByProject,
      thumbnailInFlight,
    )

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
      history: historyStore.serializeHistory(),
      historyPointer: historyStore.getHistoryPointer(),
      zoom: boundUiState.value?.zoom.value ?? ZOOM.DEFAULT,
      bookmarksTree: store.bookmarksTree,
      bookmarksDirty: store.bookmarksDirty,
      metadata: store.metadata,
      security: store.security,
      metadataDirty: store.metadataDirty,
      ignoredPreflightRuleIds: boundUiState.value?.ignoredPreflightRuleIds.value ?? [],
    }

    const state = buildProjectState(id, snapshot)
    state.updatedAt = now

    await db.projects.put(meta)
    await db.states.put(state)

    activeProjectMeta.value = meta
  }

  async function hydrateStore(meta: ProjectMeta, state: ProjectState): Promise<void> {
    store.reset()
    historyStore.clearHistory()
    clearCache()

    const files = await db.files.where('id').anyOf(state.activeSourceIds ?? []).toArray()
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

    store.setProjectTitle(meta.title)
    boundUiState.value?.setZoom(state.zoom ?? ZOOM.DEFAULT)
    store.setBookmarksDirty(state.bookmarksDirty ?? false)
    store.setPages(state.pageMap ?? [])
    boundUiState.value?.setIgnoredPreflightRuleIds(state.ignoredPreflightRuleIds ?? [])

    if (state.metadata) {
      store.setMetadata(state.metadata, false)
    }

    store.setMetadataDirty(
      state.metadataDirty ??
        (state.metadata ? !isDefaultMetadata(state.metadata as DocumentMetadata) : false),
    )

    if (state.security) {
      store.setSecurity(state.security)
    }

    if (store.bookmarksDirty) {
      const restoredTree = coerceBookmarkTree(state.bookmarksTree)
      store.setBookmarksTree(restoredTree, false)
    }

    historyStore.rehydrateHistory(
      state.history ?? [],
      state.historyPointer ?? HISTORY.POINTER_START,
      state.updatedAt,
    )
  }

  async function loadProject(id: string): Promise<boolean> {
    if (!id) return false
    isHydrating.value = true
    boundUiState.value?.setLoading(true, 'Loading project...')

    try {
      const [meta, rawState] = await Promise.all([db.projects.get(id), db.states.get(id)])
      if (!meta || !rawState) return false

      await hydrateStore(meta, rawState)
      activeProjectId.value = id
      activeProjectMeta.value = meta
      setLastActiveProjectId(id)

      const firstPage = getFirstPageReference(rawState.pageMap as PageReference[])
      thumbnailKeyByProject.set(id, getThumbnailKey(firstPage))
      const liveState: GcStateSnapshot = {
        activeSourceIds: Array.from(store.sources.keys()),
        pages: store.pages,
        history: historyStore.serializeHistory(),
      }
      void garbageCollectStoredSources(liveState)
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
    const meta = await db.projects.get(id)
    if (!meta) return
    const updated: ProjectMeta = {
      ...meta,
      title: normalizeTitle(title),
      updatedAt: Date.now(),
    }
    await db.projects.put(updated)

    if (activeProjectId.value === id) {
      activeProjectMeta.value = updated
      store.setProjectTitle(updated.title)
    }
  }

  async function duplicateProject(id: string): Promise<ProjectMeta | null> {
    const [meta, state] = await Promise.all([db.projects.get(id), db.states.get(id)])
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

    await db.projects.put(duplicateMeta)
    await db.states.put(duplicateState)

    return duplicateMeta
  }

  async function deleteProject(id: string): Promise<void> {
    await db.projects.delete(id)
    await db.states.delete(id)
    if (activeProjectId.value === id) {
      activeProjectId.value = null
      activeProjectMeta.value = null
      setLastActiveProjectId(null)
    }
    if (getLastActiveProjectId() === id) {
      setLastActiveProjectId(null)
    }
    await garbageCollectStoredSources()
  }

  setupAutoSave()

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
})
