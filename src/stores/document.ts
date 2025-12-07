import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SourceFile, PageReference, SelectionState } from '@/types'

/**
 * Main document store following the Virtual Map architecture.
 *
 * This store holds references, not actual PDF data.
 * PDF blobs are stored separately (in memory for now, IndexedDB later).
 */
export const useDocumentStore = defineStore('document', () => {
  // ============================================
  // State
  // ============================================

  /**
   * Map of source files by ID.
   * The actual blobs are stored in pdfBlobStore (separate Map).
   */
  const sources = ref<Map<string, SourceFile>>(new Map())

  /**
   * The ordered list of page references - this IS the document.
   * Reordering this array reorders the final PDF.
   */
  const pages = ref<PageReference[]>([])

  /**
   * Current selection state
   */
  const selection = ref<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
  })

  /**
   * Loading state for async operations
   */
  const isLoading = ref(false)
  const loadingMessage = ref('')

  /**
   * View state
   */
  /**
   * View state (thumbnail width in px)
   */
  const zoom = ref(220) // Default 220px
  const MIN_ZOOM = 120
  const MAX_ZOOM = 320
  const ZOOM_STEP = 20

  /**
   * Tool state
   */
  const currentTool = ref<'select' | 'razor'>('select')

  // ============================================
  // Getters
  // ============================================

  const pageCount = computed(() => pages.value.filter(p => !p.deleted && !p.isDivider).length)

  const zoomPercentage = computed(() => Math.round((zoom.value / 200) * 100))

  const hasPages = computed(() => pageCount.value > 0)

  // Get all pages including deleted ones (internal use)
  const allPagesCount = computed(() => pages.value.length)

  const selectedPages = computed(() =>
    pages.value.filter((p) => selection.value.selectedIds.has(p.id)),
  )

  const selectedCount = computed(() => selection.value.selectedIds.size)

  const sourceFileList = computed(() => Array.from(sources.value.values()))

  // ============================================
  // Actions
  // ============================================

  function addSourceFile(sourceFile: SourceFile) {
    sources.value.set(sourceFile.id, sourceFile)
  }

  function removeSourceFile(sourceFileId: string) {
    sources.value.delete(sourceFileId)
    // Also remove all page references from this source
    pages.value = pages.value.filter((p) => p.sourceFileId !== sourceFileId)
  }

  function addPages(newPages: PageReference[]) {
    pages.value.push(...newPages)
  }

  function insertPages(index: number, newPages: PageReference[]) {
    pages.value.splice(index, 0, ...newPages)
  }

  function removePage(pageId: string) {
    const index = pages.value.findIndex((p) => p.id === pageId)
    if (index !== -1) {
      pages.value.splice(index, 1)
    }
    selection.value.selectedIds.delete(pageId)
  }

  /**
   * Soft delete pages (mark as deleted)
   */
  function softDeletePages(ids: string[]) {
    const idsSet = new Set(ids)
    for (const page of pages.value) {
      if (idsSet.has(page.id)) {
        page.deleted = true
      }
    }
    // Deselect deleted pages
    selection.value.selectedIds = new Set(
      [...selection.value.selectedIds].filter(id => !idsSet.has(id))
    )
    if (selection.value.lastSelectedId && idsSet.has(selection.value.lastSelectedId)) {
      selection.value.lastSelectedId = null
    }
  }

  /**
   * Restore soft-deleted pages
   */
  function restorePages(ids: string[]) {
    const idsSet = new Set(ids)
    for (const page of pages.value) {
      if (idsSet.has(page.id)) {
        page.deleted = false
      }
    }
  }

  /**
   * Document Title State
   */
  const projectTitle = ref('Untitled Project')
  const isTitleLocked = ref(false) // Locked after first import

   /**
   * Split group at index (Razor Tool)
   * Inserts a "Divider Object" (virtual page) at the index
   */
  function splitGroup(pageIndex: number) {
    if (pageIndex <= 0 || pageIndex >= pages.value.length) return

    // Insert Divider Object
    const divider: PageReference = {
      id: crypto.randomUUID(),
      sourceFileId: 'virtual-divider',
      sourcePageIndex: -1,
      rotation: 0,
      isDivider: true,
      groupId: crypto.randomUUID() // Divider starts a new group effectively
    }

    // Insert at index
    pages.value.splice(pageIndex, 0, divider)
  }

  /**
   * Permanently remove deleted pages ("Empty Trash")
   */
  function purgeDeletedPages() {
    pages.value = pages.value.filter(p => !p.deleted)
  }

  /**
   * Remove specific pages (Permanent)
   * @deprecated logic updated to support soft delete if needed, but for now strict removal
   */
  function removePages(ids: string[]) {
    // For backward compatibility or strict removal
    const idsSet = new Set(ids)
    pages.value = pages.value.filter((p) => !idsSet.has(p.id))

    // Cleanup selection
    selection.value.selectedIds = new Set(
      [...selection.value.selectedIds].filter((id) => !idsSet.has(id))
    )
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

  // Selection actions
  function selectPage(pageId: string, addToSelection = false) {
    if (!addToSelection) {
      selection.value.selectedIds.clear()
    }
    selection.value.selectedIds.add(pageId)
    selection.value.lastSelectedId = pageId
  }

  function deselectPage(pageId: string) {
    selection.value.selectedIds.delete(pageId)
    if (selection.value.lastSelectedId === pageId) {
      selection.value.lastSelectedId = null
    }
  }

  function togglePageSelection(pageId: string) {
    if (selection.value.selectedIds.has(pageId)) {
      deselectPage(pageId)
    } else {
      selectPage(pageId, true)
    }
  }

  function selectRange(fromId: string, toId: string) {
    const fromIndex = pages.value.findIndex((p) => p.id === fromId)
    const toIndex = pages.value.findIndex((p) => p.id === toId)

    if (fromIndex === -1 || toIndex === -1) return

    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)

    for (let i = start; i <= end; i++) {
      const page = pages.value[i]
      if (page) {
        selection.value.selectedIds.add(page.id)
      }
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

  // Loading state helpers
  function setLoading(loading: boolean, message = '') {
    isLoading.value = loading
    loadingMessage.value = message
  }

  // Reset everything
  function reset() {
    sources.value.clear()
    pages.value = []
    clearSelection()
    isLoading.value = false
    loadingMessage.value = ''
  }

  function setZoom(level: number) {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level))
  }

  function zoomIn() {
    setZoom(zoom.value + ZOOM_STEP)
  }

  function zoomOut() {
    setZoom(zoom.value - ZOOM_STEP)
  }

  return {
    // State
    sources,
    pages,
    selection,
    isLoading,
    loadingMessage,
    zoom,
    currentTool,

    // Getters
    pageCount,
    zoomPercentage,
    hasPages,
    allPagesCount,
    selectedPages,
    selectedCount,
    sourceFileList,

    // Actions
    addSourceFile,
    removeSourceFile,
    addPages,
    insertPages,
    removePage,
    // Soft delete actions
    softDeletePages,
    restorePages,
    splitGroup,
    purgeDeletedPages,

    // Legacy actions (updated internally)
    removePages,
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
    setZoom,
    zoomIn,
    zoomOut,
    projectTitle,
    isTitleLocked,
  }
})
