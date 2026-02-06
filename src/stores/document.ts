import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { ROTATION_FULL_DEGREES, type RotationAngle, type RotationDelta } from '@/constants'
import type {
  SourceFile,
  PageReference,
  PageEntry,
  SelectionState,
  OutlineNode,
  DocumentMetadata,
  SecurityMetadata,
  RedactionMark,
} from '@/types'
import { isPageEntry } from '@/types'

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
  const pagesStructureVersion = shallowRef(0)
  const pagesVersion = shallowRef(0)
  const sourcesVersion = shallowRef(0)
  const outlineVersion = shallowRef(0)
  const metadataVersion = shallowRef(0)
  const securityVersion = shallowRef(0)
  const metadata = ref<DocumentMetadata>({ ...DEFAULT_METADATA })
  const security = ref<SecurityMetadata>({ ...DEFAULT_SECURITY })
  const outlineTree = ref<OutlineNode[]>([])
  const outlineDirty = shallowRef(false)
  const metadataDirty = shallowRef(false)
  const projectTitle = shallowRef('Untitled Project')
  const isTitleLocked = shallowRef(false)

  const selection = ref<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
  })
  const activePageId = shallowRef<string | null>(null)


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

  function bumpPagesStructureVersion() {
    pagesStructureVersion.value += 1
    bumpPagesVersion()
  }

  function bumpPagesVersion() {
    pagesVersion.value += 1
  }

  function bumpSourcesVersion() {
    sourcesVersion.value += 1
  }

  function bumpOutlineVersion() {
    outlineVersion.value += 1
  }

  function bumpMetadataVersion() {
    metadataVersion.value += 1
  }

  function bumpSecurityVersion() {
    securityVersion.value += 1
  }

  function addSourceFile(sourceFile: SourceFile) {
    sources.value.set(sourceFile.id, sourceFile)
    bumpSourcesVersion()
  }

  function removeSourceFile(sourceFileId: string) {
    sources.value.delete(sourceFileId)
    pages.value = pages.value.filter((p) => (p.isDivider ? true : p.sourceFileId !== sourceFileId))
    bumpSourcesVersion()
    bumpPagesStructureVersion()
  }

  function removeSourceOnly(sourceFileId: string) {
    sources.value.delete(sourceFileId)
    bumpSourcesVersion()
  }

  function addPages(newPages: PageReference[]) {
    pages.value.push(...newPages)
    bumpPagesStructureVersion()
  }

  function insertPages(index: number, newPages: PageEntry[]) {
    if (index < 0) index = 0
    if (index > pages.value.length) index = pages.value.length

    pages.value.splice(index, 0, ...newPages)
    bumpPagesStructureVersion()
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
    bumpPagesStructureVersion()
  }

  function reorderPages(newOrder: PageEntry[]) {
    pages.value = newOrder
    bumpPagesStructureVersion()
  }

  function rotatePage(pageId: string, degrees: RotationDelta) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (page) {
      const current = page.rotation
      const newRotation =
        ((current + degrees + ROTATION_FULL_DEGREES) % ROTATION_FULL_DEGREES) as RotationAngle
      page.rotation = newRotation
      bumpPagesVersion()
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
    bumpPagesVersion()
  }

  function addRedaction(pageId: string, redaction: RedactionMark) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page) return
    if (!page.redactions) page.redactions = []
    page.redactions.push({ ...redaction })
    bumpPagesVersion()
  }

  function addRedactions(pageId: string, redactions: RedactionMark[]) {
    if (!redactions || redactions.length === 0) return
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page) return
    if (!page.redactions) page.redactions = []
    page.redactions.push(...redactions.map((r) => ({ ...r })))
    bumpPagesVersion()
  }

  function updateRedaction(pageId: string, redaction: RedactionMark) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page?.redactions?.length) return
    page.redactions = page.redactions.map((r) => (r.id === redaction.id ? { ...redaction } : r))
    bumpPagesVersion()
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
    bumpPagesVersion()
  }

  function clearRedactions(pageId: string) {
    const page = pages.value.find((p): p is PageReference => isPageEntry(p) && p.id === pageId)
    if (!page) return
    page.redactions = []
    bumpPagesVersion()
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

  function setActivePageId(pageId: string | null) {
    activePageId.value = pageId
  }

  // === META ===

  function setMetadata(next: Partial<DocumentMetadata>, markDirty = true) {
    metadata.value = { ...metadata.value, ...next }
    bumpMetadataVersion()
    if (markDirty) metadataDirty.value = true
  }

  function addKeyword(keyword: string) {
    const k = keyword.trim()
    if (!k) return
    if (!metadata.value.keywords.includes(k)) {
      metadata.value.keywords.push(k)
      bumpMetadataVersion()
      metadataDirty.value = true
    }
  }

  function removeKeyword(keyword: string) {
    const nextKeywords = metadata.value.keywords.filter((k) => k !== keyword)
    if (nextKeywords.length === metadata.value.keywords.length) return
    metadata.value.keywords = nextKeywords
    bumpMetadataVersion()
    metadataDirty.value = true
  }

  function clearKeywords() {
    if (metadata.value.keywords.length === 0) return
    metadata.value.keywords = []
    bumpMetadataVersion()
    metadataDirty.value = true
  }

  function resetMetadata() {
    metadata.value = { ...DEFAULT_METADATA }
    bumpMetadataVersion()
    metadataDirty.value = false
  }

  function setSecurity(next: Partial<SecurityMetadata>) {
    security.value = { ...security.value, ...next }
    bumpSecurityVersion()
  }

  function resetSecurity() {
    security.value = { ...DEFAULT_SECURITY }
    bumpSecurityVersion()
  }

  function normalizeOutlineTree(
    nodes: OutlineNode[],
    parentId: string | null = null,
  ): OutlineNode[] {
    return (nodes ?? []).map((node) => {
      const children = normalizeOutlineTree(node.children ?? [], node.id)
      return {
        ...node,
        parentId,
        children,
      }
    })
  }

  function setOutlineTree(tree: OutlineNode[], markDirty = false) {
    outlineTree.value = normalizeOutlineTree(tree)
    bumpOutlineVersion()
    if (markDirty) outlineDirty.value = true
  }

  function markOutlineDirty() {
    outlineDirty.value = true
  }

  function resetOutline() {
    outlineTree.value = []
    bumpOutlineVersion()
    outlineDirty.value = false
  }

  function setOutlineDirty(value: boolean) {
    outlineDirty.value = value
  }

  function setPages(newPages: PageEntry[]) {
    pages.value = newPages
    bumpPagesStructureVersion()
  }

  function getSourceColor(sourceId: string, fallback = 'gray') {
    return sources.value.get(sourceId)?.color ?? fallback
  }

  function addOutlineNodeForPage(pageId: string, title = 'New Bookmark') {
    const node: OutlineNode = {
      id: crypto.randomUUID(),
      parentId: null,
      title,
      expanded: true,
      dest: {
        type: 'page',
        targetPageId: pageId,
        fit: 'Fit',
      },
      children: [],
    }

    setOutlineTree([...outlineTree.value, node], true)
  }

  function reset() {
    sources.value.clear()
    pages.value = []
    clearSelection()
    activePageId.value = null
    projectTitle.value = 'Untitled Project'
    isTitleLocked.value = false
    resetMetadata()
    resetSecurity()
    resetOutline()
    bumpSourcesVersion()
    bumpPagesStructureVersion()
  }

  function setProjectTitle(value: string) {
    projectTitle.value = value
  }

  function setMetadataDirty(value: boolean) {
    metadataDirty.value = value
  }


  // Outline is updated explicitly during import or reset actions.

  return {
    sources,
    pages,
    pagesStructureVersion,
    pagesVersion,
    sourcesVersion,
    outlineVersion,
    metadataVersion,
    securityVersion,
    selection,
    activePageId,
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
    setActivePageId,
    reset,
    setPages,
    getSourceColor,
    projectTitle,
    isTitleLocked,
    setProjectTitle,
    outlineTree,
    outlineDirty,
    setOutlineTree,
    markOutlineDirty,
    resetOutline,
    setOutlineDirty,
    addOutlineNodeForPage,
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
