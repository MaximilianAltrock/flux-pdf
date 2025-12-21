import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { SourceFile, PageReference, SelectionState, UiBookmarkNode } from '@/types'
import { autoGenBookmarksFromPages } from '@/utils/autoGen'

export interface DocumentMetadata {
  title: string
  author: string
  subject: string
  keywords: string[]
  pdfVersion?: '1.4' | '1.7' | '2.0' | 'PDF/A' // optional: you may not support these yet
}

export const useDocumentStore = defineStore('document', () => {
  // ============================================
  // State
  // ============================================

  const sources = ref<Map<string, SourceFile>>(new Map())
  const pages = ref<PageReference[]>([])
  const metadata = ref<DocumentMetadata>({
    title: 'Untitled Project',
    author: '',
    subject: '',
    keywords: [],
  })
  const bookmarksTree = ref<UiBookmarkNode[]>([])
  const bookmarksDirty = ref(false)

  const selection = ref<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
  })

  const isLoading = ref(false)
  const loadingMessage = ref('')

  // View state
  const zoom = ref(220)
  const MIN_ZOOM = 120
  const MAX_ZOOM = 320
  const ZOOM_STEP = 20

  const currentTool = ref<'select' | 'razor'>('select')

  // ============================================
  // Getters
  // ============================================

  // Divider logic: dividers are virtual pages
  const pageCount = computed(() => pages.value.filter((p) => !p.isDivider).length)
  const hasPages = computed(() => pageCount.value > 0)

  const zoomPercentage = computed(() => Math.round((zoom.value / 200) * 100))
  const sourceFileList = computed(() => Array.from(sources.value.values()))
  const selectedCount = computed(() => selection.value.selectedIds.size)
  const selectedPages = computed(() =>
    pages.value.filter((p) => selection.value.selectedIds.has(p.id)),
  )

  // ============================================
  // Actions
  // ============================================

  function addSourceFile(sourceFile: SourceFile) {
    sources.value.set(sourceFile.id, sourceFile)
  }

  function removeSourceFile(sourceFileId: string) {
    sources.value.delete(sourceFileId)
    pages.value = pages.value.filter((p) => p.sourceFileId !== sourceFileId)
  }

  function removeSourceOnly(sourceFileId: string) {
    sources.value.delete(sourceFileId)
  }

  function addPages(newPages: PageReference[]) {
    pages.value.push(...newPages)
  }

  function insertPages(index: number, newPages: PageReference[]) {
    if (index < 0) index = 0
    if (index > pages.value.length) index = pages.value.length

    pages.value.splice(index, 0, ...newPages)
  }

  // === HARD DELETE (The only delete now) ===
  function deletePages(ids: string[]) {
    const idsSet = new Set(ids)
    pages.value = pages.value.filter((p) => !idsSet.has(p.id))

    // Cleanup selection
    const newSelected = new Set([...selection.value.selectedIds].filter((id) => !idsSet.has(id)))
    selection.value.selectedIds = newSelected

    if (selection.value.lastSelectedId && idsSet.has(selection.value.lastSelectedId)) {
      selection.value.lastSelectedId = null
    }
  }

  function reorderPages(newOrder: PageReference[]) {
    pages.value = newOrder
  }

  function rotatePage(pageId: string, degrees: 90 | -90) {
    const page = pages.value.find((p) => p.id === pageId)
    if (page) {
      const current = page.rotation
      const newRotation = ((current + degrees + 360) % 360) as 0 | 90 | 180 | 270
      page.rotation = newRotation
    }
  }

  // === SELECTION ===
  function selectPage(pageId: string, addToSelection = false) {
    if (!addToSelection) selection.value.selectedIds.clear()
    selection.value.selectedIds.add(pageId)
    selection.value.lastSelectedId = pageId
  }

  function deselectPage(pageId: string) {
    selection.value.selectedIds.delete(pageId)
    if (selection.value.lastSelectedId === pageId) selection.value.lastSelectedId = null
  }

  function togglePageSelection(pageId: string) {
    if (selection.value.selectedIds.has(pageId)) deselectPage(pageId)
    else selectPage(pageId, true)
  }

  function selectRange(fromId: string, toId: string) {
    const fromIndex = pages.value.findIndex((p) => p.id === fromId)
    const toIndex = pages.value.findIndex((p) => p.id === toId)
    if (fromIndex === -1 || toIndex === -1) return

    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)

    for (let i = start; i <= end; i++) {
      const page = pages.value[i]
      if (page) selection.value.selectedIds.add(page.id)
    }
    selection.value.lastSelectedId = toId
  }

  function selectAll() {
    pages.value.forEach((p) => selection.value.selectedIds.add(p.id))
  }

  function clearSelection() {
    selection.value.selectedIds.clear()
    selection.value.lastSelectedId = null
  }

  // === TOOLS & META ===
  function setLoading(loading: boolean, message = '') {
    isLoading.value = loading
    loadingMessage.value = message
  }

  function setMetadata(next: Partial<DocumentMetadata>) {
    metadata.value = { ...metadata.value, ...next }
  }

  function addKeyword(keyword: string) {
    const k = keyword.trim()
    if (!k) return
    if (!metadata.value.keywords.includes(k)) {
      metadata.value.keywords.push(k)
    }
  }

  function removeKeyword(keyword: string) {
    metadata.value.keywords = metadata.value.keywords.filter((k) => k !== keyword)
  }

  function clearKeywords() {
    metadata.value.keywords = []
  }

  function resetMetadata() {
    metadata.value = { title: '', author: '', subject: '', keywords: [] }
  }

  function setBookmarksTree(tree: UiBookmarkNode[], markDirty = false) {
    bookmarksTree.value = tree
    if (markDirty) bookmarksDirty.value = true
  }

  function markBookmarksDirty() {
    bookmarksDirty.value = true
  }

  function resetBookmarks() {
    bookmarksTree.value = []
    bookmarksDirty.value = false
  }

  function setPages(newPages: PageReference[]) {
    pages.value = newPages
  }

  function addBookmarkForPage(pageId: string, title = 'New Bookmark') {
    const node: UiBookmarkNode = {
      id: crypto.randomUUID(),
      title,
      pageId,
      children: [],
      expanded: true,
    }

    setBookmarksTree([...bookmarksTree.value, node], true)
  }

  function reset() {
    sources.value.clear()
    pages.value = []
    clearSelection()
    isLoading.value = false
    loadingMessage.value = ''
    projectTitle.value = 'Untitled Project'
    isTitleLocked.value = false
    resetMetadata()
    resetBookmarks()
  }

  const projectTitle = ref('Untitled Project')
  const isTitleLocked = ref(false)

  function setZoom(level: number) {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level))
  }
  function zoomIn() {
    setZoom(zoom.value + ZOOM_STEP)
  }
  function zoomOut() {
    setZoom(zoom.value - ZOOM_STEP)
  }

  watch(
    [pages, sources, bookmarksDirty],
    () => {
      if (bookmarksDirty.value) return
      bookmarksTree.value = autoGenBookmarksFromPages(pages.value, sources.value)
    },
    { deep: true },
  )

  return {
    sources,
    pages,
    selection,
    isLoading,
    loadingMessage,
    zoom,
    currentTool,
    pageCount,
    zoomPercentage,
    hasPages,
    selectedPages,
    selectedCount,
    sourceFileList,
    addSourceFile,
    removeSourceFile,
    removeSourceOnly,
    addPages,
    insertPages,
    deletePages,
    reorderPages,
    rotatePage,
    selectPage,
    deselectPage,
    togglePageSelection,
    selectRange,
    selectAll,
    clearSelection,
    setLoading,
    reset,
    setPages,
    setZoom,
    zoomIn,
    zoomOut,
    projectTitle,
    isTitleLocked,
    bookmarksTree,
    bookmarksDirty,
    setBookmarksTree,
    markBookmarksDirty,
    resetBookmarks,
    addBookmarkForPage,
    metadata,
    setMetadata,
    addKeyword,
    removeKeyword,
    clearKeywords,
    resetMetadata,
  }
})
