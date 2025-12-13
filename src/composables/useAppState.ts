import { ref, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useMobile } from '@/composables/useMobile'
import type { PageReference } from '@/types'

/**
 * Centralized app-level state management
 * Handles all modal/sheet visibility, selection modes, and UI state
 */
export function useAppState() {
  const store = useDocumentStore()
  const { isMobile } = useMobile()

  // ============================================
  // File Input Reference
  // ============================================
  const fileInputRef = ref<HTMLInputElement | null>(null)

  // ============================================
  // Desktop State
  // ============================================
  const showCommandPalette = ref(false)
  const documentTitle = ref('flux-pdf-export')

  // ============================================
  // Mobile State
  // ============================================
  const mobileSelectionMode = ref(false)
  const showMenuDrawer = ref(false)
  const showTitleSheet = ref(false)
  const showAddSheet = ref(false)
  const showActionSheet = ref(false)

  // ============================================
  // Shared Modal State
  // ============================================
  const showExportModal = ref(false)
  const exportSelectedOnly = ref(false)
  const showPreviewModal = ref(false)
  const previewPageRef = ref<PageReference | null>(null)
  const showDiffModal = ref(false)
  const diffPages = ref<[PageReference, PageReference] | null>(null)

  // ============================================
  // Computed Properties
  // ============================================
  const hasPages = computed(() => store.pageCount > 0)
  const selectedCount = computed(() => store.selectedCount)
  const isLoading = computed(() => store.isLoading)
  const loadingMessage = computed(() => store.loadingMessage)

  // Track if any modal is open (for blocking global shortcuts)
  const hasOpenModal = computed(() =>
    showExportModal.value ||
    showPreviewModal.value ||
    showDiffModal.value ||
    showCommandPalette.value
  )

  // ============================================
  // State Setters (for cleaner event handling)
  // ============================================
  function openCommandPalette() {
    if (!isMobile.value) {
      showCommandPalette.value = true
    }
  }

  function closeCommandPalette() {
    showCommandPalette.value = false
  }

  function toggleCommandPalette() {
    if (!isMobile.value) {
      showCommandPalette.value = !showCommandPalette.value
    }
  }

  function openExportModal(selectedOnly = false) {
    exportSelectedOnly.value = selectedOnly
    showExportModal.value = true
  }

  function closeExportModal() {
    showExportModal.value = false
  }

  function openPreviewModal(pageRef: PageReference) {
    // Ensure the page is selected so navigation continues from here
    store.selectPage(pageRef.id, false)
    previewPageRef.value = pageRef
    showPreviewModal.value = true
  }

  function closePreviewModal() {
    // Restore selection to the last viewed page for keyboard navigation continuity
    if (previewPageRef.value) {
      store.selectPage(previewPageRef.value.id, false)
    }
    showPreviewModal.value = false
    previewPageRef.value = null
  }

  function navigatePreview(pageRef: PageReference) {
    previewPageRef.value = pageRef
  }

  function openDiffModal(pageA: PageReference, pageB: PageReference) {
    diffPages.value = [pageA, pageB]
    showDiffModal.value = true
  }

  function closeDiffModal() {
    showDiffModal.value = false
    diffPages.value = null
  }

  // ============================================
  // Mobile State Management
  // ============================================
  function enterMobileSelectionMode() {
    mobileSelectionMode.value = true
  }

  function exitMobileSelectionMode() {
    mobileSelectionMode.value = false
    store.clearSelection()
  }

  function openMenuDrawer() {
    showMenuDrawer.value = true
  }

  function closeMenuDrawer() {
    showMenuDrawer.value = false
  }

  function openTitleSheet() {
    showTitleSheet.value = true
  }

  function closeTitleSheet() {
    showTitleSheet.value = false
  }

  function openAddSheet() {
    showAddSheet.value = true
  }

  function closeAddSheet() {
    showAddSheet.value = false
  }

  function openActionSheet() {
    showActionSheet.value = true
  }

  function closeActionSheet() {
    showActionSheet.value = false
  }

  // ============================================
  // Document Title Management
  // ============================================
  function updateDocumentTitle(title: string) {
    documentTitle.value = title
  }

  // ============================================
  // File Input Management
  // ============================================
  function openFileDialog() {
    fileInputRef.value?.click()
  }

  function clearFileInput() {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }

  return {
    // Refs
    fileInputRef,

    // Desktop State
    showCommandPalette,
    documentTitle,

    // Mobile State
    mobileSelectionMode,
    showMenuDrawer,
    showTitleSheet,
    showAddSheet,
    showActionSheet,

    // Shared Modal State
    showExportModal,
    exportSelectedOnly,
    showPreviewModal,
    previewPageRef,

    // Computed
    hasPages,
    selectedCount,
    isLoading,
    loadingMessage,
    hasOpenModal,
    isMobile,

    // Desktop Actions
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,

    // Export Modal Actions
    openExportModal,
    closeExportModal,

    // Preview Modal Actions
    openPreviewModal,
    closePreviewModal,
    navigatePreview,

    // Mobile Actions
    enterMobileSelectionMode,
    exitMobileSelectionMode,
    openMenuDrawer,
    closeMenuDrawer,
    openTitleSheet,
    closeTitleSheet,
    openAddSheet,
    closeAddSheet,
    openActionSheet,
    closeActionSheet,

    // File Input Actions
    openFileDialog,
    clearFileInput,

    // Document Title
    updateDocumentTitle,

    showDiffModal,
    diffPages,
    openDiffModal,
    closeDiffModal,
  }
}

// Export type for use in layouts
export type AppState = ReturnType<typeof useAppState>
