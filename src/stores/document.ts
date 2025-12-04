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

  // ============================================
  // Getters
  // ============================================

  const pageCount = computed(() => pages.value.length)

  const hasPages = computed(() => pages.value.length > 0)

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

  function removePages(pageIds: string[]) {
    const idsToRemove = new Set(pageIds)
    pages.value = pages.value.filter((p) => !idsToRemove.has(p.id))
    pageIds.forEach((id) => selection.value.selectedIds.delete(id))
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
      selection.value.selectedIds.add(pages.value[i].id)
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

  return {
    // State
    sources,
    pages,
    selection,
    isLoading,
    loadingMessage,

    // Getters
    pageCount,
    hasPages,
    selectedPages,
    selectedCount,
    sourceFileList,

    // Actions
    addSourceFile,
    removeSourceFile,
    addPages,
    insertPages,
    removePage,
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
  }
})
