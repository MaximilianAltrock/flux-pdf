import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { ROTATION_FULL_DEGREES, type RotationAngle, type RotationDelta } from '@/constants'
import type {
  SourceFile,
  PageReference,
  PageEntry,
  SelectionState,
  BookmarkNode,
  DocumentMetadata,
  SecurityMetadata,
  RedactionMark,
} from '@/types'
import { isPageEntry } from '@/types'
import { autoGenBookmarksFromPages } from '@/utils/auto-gen-tree'

export const useDocumentStore = defineStore('document', () => {
  // ============================================
  // State
  // ============================================

  const DEFAULT_METADATA: DocumentMetadata = {
    title: 'Untitled Project',
    author: '',
    subject: '',
    keywords: [],
  }

  const DEFAULT_SECURITY: SecurityMetadata = {
    isEncrypted: false,
    userPassword: '',
    ownerPassword: '',
    allowPrinting: true,
    allowCopying: true,
    allowModifying: false,
  }

  const sources = ref<Map<string, SourceFile>>(new Map())
  const pages = ref<PageEntry[]>([])
  const metadata = ref<DocumentMetadata>({ ...DEFAULT_METADATA })
  const security = ref<SecurityMetadata>({ ...DEFAULT_SECURITY })
  const bookmarksTree = ref<BookmarkNode[]>([])
  const bookmarksDirty = ref(false)
  const metadataDirty = ref(false)
  const projectTitle = ref('Untitled Project')
  const isTitleLocked = ref(false)

  const selection = ref<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
  })


  // ============================================
  // Getters
  // ============================================

  // Divider logic: dividers are virtual pages
  const contentPages = computed(() => pages.value.filter(isPageEntry))
  const contentPageCount = computed(() => contentPages.value.length)
  const pageCount = computed(() => contentPageCount.value)
  const hasPages = computed(() => contentPageCount.value > 0)

  const sourceFileList = computed(() => Array.from(sources.value.values()))
  const selectedCount = computed(() => selection.value.selectedIds.size)
  const selectedPages = computed(() =>
    contentPages.value.filter((p) => selection.value.selectedIds.has(p.id)),
  )
  const selectedIds = computed(() => selection.value.selectedIds)
  const lastSelectedId = computed(() => selection.value.lastSelectedId)
  const redactionCount = computed(() =>
    contentPages.value.reduce((sum, page) => sum + (page.redactions?.length ?? 0), 0),
  )
  const hasRedactions = computed(() => redactionCount.value > 0)

  // ============================================
  // Actions
  // ============================================

  function addSourceFile(sourceFile: SourceFile) {
    sources.value.set(sourceFile.id, sourceFile)
  }

  function removeSourceFile(sourceFileId: string) {
    sources.value.delete(sourceFileId)
    pages.value = pages.value.filter((p) => (p.isDivider ? true : p.sourceFileId !== sourceFileId))
  }

  function removeSourceOnly(sourceFileId: string) {
    sources.value.delete(sourceFileId)
  }

  function addPages(newPages: PageReference[]) {
    pages.value.push(...newPages)
  }

  function insertPages(index: number, newPages: PageEntry[]) {
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

  function reorderPages(newOrder: PageEntry[]) {
    pages.value = newOrder
  }

  function rotatePage(pageId: string, degrees: RotationDelta) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (page) {
      const current = page.rotation
      const newRotation =
        ((current + degrees + ROTATION_FULL_DEGREES) % ROTATION_FULL_DEGREES) as RotationAngle
      page.rotation = newRotation
    }
  }

  function setPageTargetDimensions(
    pageId: string,
    targetDimensions?: { width: number; height: number } | null,
  ) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page) return
    if (targetDimensions) {
      page.targetDimensions = { ...targetDimensions }
    } else {
      page.targetDimensions = undefined
    }
  }

  function addRedaction(pageId: string, redaction: RedactionMark) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page) return
    if (!page.redactions) page.redactions = []
    page.redactions.push({ ...redaction })
  }

  function addRedactions(pageId: string, redactions: RedactionMark[]) {
    if (!redactions || redactions.length === 0) return
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page) return
    if (!page.redactions) page.redactions = []
    page.redactions.push(...redactions.map((r) => ({ ...r })))
  }

  function updateRedaction(pageId: string, redaction: RedactionMark) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page?.redactions?.length) return
    page.redactions = page.redactions.map((r) => (r.id === redaction.id ? { ...redaction } : r))
  }

  function removeRedaction(pageId: string, redactionId: string) {
    removeRedactions(pageId, [redactionId])
  }

  function removeRedactions(pageId: string, redactionIds: string[]) {
    if (!redactionIds || redactionIds.length === 0) return
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page?.redactions?.length) return
    const removeSet = new Set(redactionIds)
    page.redactions = page.redactions.filter((r) => !removeSet.has(r.id))
  }

  function clearRedactions(pageId: string) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page) return
    page.redactions = []
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
      if (page && !page.isDivider) {
        selection.value.selectedIds.add(page.id)
      }
    }
    selection.value.lastSelectedId = toId
  }

  function selectAll() {
    contentPages.value.forEach((p) => selection.value.selectedIds.add(p.id))
  }

  function clearSelection() {
    selection.value.selectedIds.clear()
    selection.value.lastSelectedId = null
  }

  // === META ===

  function setMetadata(next: Partial<DocumentMetadata>, markDirty = true) {
    metadata.value = { ...metadata.value, ...next }
    if (markDirty) metadataDirty.value = true
  }

  function addKeyword(keyword: string) {
    const k = keyword.trim()
    if (!k) return
    if (!metadata.value.keywords.includes(k)) {
      metadata.value.keywords.push(k)
      metadataDirty.value = true
    }
  }

  function removeKeyword(keyword: string) {
    metadata.value.keywords = metadata.value.keywords.filter((k) => k !== keyword)
    metadataDirty.value = true
  }

  function clearKeywords() {
    metadata.value.keywords = []
    metadataDirty.value = true
  }

  function resetMetadata() {
    metadata.value = { ...DEFAULT_METADATA }
    metadataDirty.value = false
  }

  function setSecurity(next: Partial<SecurityMetadata>) {
    security.value = { ...security.value, ...next }
  }

  function resetSecurity() {
    security.value = { ...DEFAULT_SECURITY }
  }

  function setBookmarksTree(tree: BookmarkNode[], markDirty = false) {
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

  function setBookmarksDirty(value: boolean) {
    bookmarksDirty.value = value
  }

  function setPages(newPages: PageEntry[]) {
    pages.value = newPages
  }

  function getSourceColor(sourceId: string, fallback = 'gray') {
    return sources.value.get(sourceId)?.color ?? fallback
  }

  function addBookmarkForPage(pageId: string, title = 'New Bookmark') {
    const node: BookmarkNode = {
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
    projectTitle.value = 'Untitled Project'
    isTitleLocked.value = false
    resetMetadata()
    resetSecurity()
    resetBookmarks()
  }

  function setProjectTitle(value: string) {
    projectTitle.value = value
  }

  function setMetadataDirty(value: boolean) {
    metadataDirty.value = value
  }


  watch(
    [pages, sources, bookmarksDirty],
    () => {
      if (bookmarksDirty.value) return
      bookmarksTree.value = autoGenBookmarksFromPages(contentPages.value, sources.value)
    },
    { deep: true },
  )

  return {
    sources,
    pages,
    selection,
    pageCount,
    contentPages,
    contentPageCount,
    hasPages,
    selectedPages,
    selectedCount,
    selectedIds,
    lastSelectedId,
    redactionCount,
    hasRedactions,
    sourceFileList,
    addSourceFile,
    removeSourceFile,
    removeSourceOnly,
    addPages,
    insertPages,
    deletePages,
    reorderPages,
    rotatePage,
    setPageTargetDimensions,
    addRedaction,
    addRedactions,
    updateRedaction,
    removeRedaction,
    removeRedactions,
    clearRedactions,
    selectPage,
    deselectPage,
    togglePageSelection,
    selectRange,
    selectAll,
    clearSelection,
    reset,
    setPages,
    getSourceColor,
    projectTitle,
    isTitleLocked,
    setProjectTitle,
    bookmarksTree,
    bookmarksDirty,
    setBookmarksTree,
    markBookmarksDirty,
    resetBookmarks,
    setBookmarksDirty,
    addBookmarkForPage,
    metadata,
    metadataDirty,
    setMetadataDirty,
    setMetadata,
    addKeyword,
    removeKeyword,
    clearKeywords,
    resetMetadata,
    security,
    setSecurity,
    resetSecurity,
  }
})
