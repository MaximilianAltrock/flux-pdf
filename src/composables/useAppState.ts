import { ref, computed } from 'vue'
import { ZOOM } from '@/constants'
import { useMobile } from '@/composables/useMobile'
import type { PageReference } from '@/types'

/**
 * Centralized app-level state management
 * Handles all modal/sheet visibility, selection modes, and UI state
 */
export function useAppState() {
  const { isMobile } = useMobile()

  // ============================================
  // UI-only Document State
  // ============================================
  const isLoading = ref(false)
  const loadingMessage = ref('')

  const zoom = ref<number>(ZOOM.DEFAULT)

  const zoomPercentage = computed(() =>
    Math.round((zoom.value / ZOOM.PERCENT_BASE) * ZOOM.PERCENT_MAX),
  )

  const currentTool = ref<'select' | 'razor'>('select')

  // ============================================
  // File Input Reference
  // ============================================
  const fileInputRef = ref<HTMLInputElement | null>(null)

  // ============================================
  // Desktop State
  // ============================================
  const showCommandPalette = ref(false)

  // ============================================
  // Mobile State
  // ============================================
  const mobileSelectionMode = ref(false)
  const mobileMoveMode = ref(false)
  const showMenuDrawer = ref(false)
  const showTitleSheet = ref(false)
  const showAddSheet = ref(false)
  const showSettingsSheet = ref(false)
  const showActionSheet = ref(false)

  // Mobile mode computed (Browse | Select | Move)
  const mobileMode = computed(() => {
    if (mobileMoveMode.value) return 'move' as const
    if (mobileSelectionMode.value) return 'select' as const
    return 'browse' as const
  })

  // ============================================
  // Shared Modal State
  // ============================================
  const showExportModal = ref(false)
  const exportSelectedOnly = ref(false)
  const showPreviewModal = ref(false)
  const previewPageRef = ref<PageReference | null>(null)
  const showDiffModal = ref(false)
  const diffPages = ref<[PageReference, PageReference] | null>(null)

  // Track if any modal is open (for blocking global shortcuts)
  const hasOpenModal = computed(
    () =>
      showExportModal.value ||
      showPreviewModal.value ||
      showDiffModal.value ||
      showCommandPalette.value ||
      showSettingsSheet.value,
  )

  // ============================================
  // State Setters (for cleaner event handling)
  // ============================================
  function setLoading(loading: boolean, message = '') {
    isLoading.value = loading
    loadingMessage.value = message
  }

  function setZoom(level: number) {
    zoom.value = Math.min(ZOOM.MAX, Math.max(ZOOM.MIN, level))
  }

  function zoomIn() {
    setZoom(zoom.value + ZOOM.STEP)
  }

  function zoomOut() {
    setZoom(zoom.value - ZOOM.STEP)
  }

  function setCurrentTool(tool: 'select' | 'razor') {
    currentTool.value = tool
  }

  function blurActiveElement() {
    if (typeof document === 'undefined') return
    const el = document.activeElement as HTMLElement | null
    el?.blur?.()
  }
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
    blurActiveElement()
    exportSelectedOnly.value = selectedOnly
    showExportModal.value = true
  }

  function closeExportModal() {
    showExportModal.value = false
  }

  function openPreviewModal(pageRef: PageReference) {
    previewPageRef.value = pageRef
    showPreviewModal.value = true
  }

  function closePreviewModal() {
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
    mobileMoveMode.value = false // Clear move mode when exiting selection
    mobileSelectionMode.value = false
  }

  function enterMobileMoveMode() {
    if (mobileSelectionMode.value) {
      mobileMoveMode.value = true
    }
  }

  function exitMobileMoveMode() {
    mobileMoveMode.value = false
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

  function openSettingsSheet() {
    showSettingsSheet.value = true
  }

  function closeSettingsSheet() {
    showSettingsSheet.value = false
  }

  function openActionSheet() {
    showActionSheet.value = true
  }

  function closeActionSheet() {
    showActionSheet.value = false
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
    // UI Document State
    isLoading,
    loadingMessage,
    zoom,
    zoomPercentage,
    currentTool,

    // Refs
    fileInputRef,

    // Desktop State
    showCommandPalette,

    // Mobile State
    mobileSelectionMode,
    mobileMoveMode,
    mobileMode,
    showMenuDrawer,
    showTitleSheet,
    showAddSheet,
    showSettingsSheet,
    showActionSheet,

    // Shared Modal State
    showExportModal,
    exportSelectedOnly,
    showPreviewModal,
    previewPageRef,

    // Computed
    hasOpenModal,
    isMobile,

    // Desktop Actions
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,

    // UI Document Actions
    setLoading,
    setZoom,
    zoomIn,
    zoomOut,
    setCurrentTool,

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
    enterMobileMoveMode,
    exitMobileMoveMode,
    openMenuDrawer,
    closeMenuDrawer,
    openTitleSheet,
    closeTitleSheet,
    openAddSheet,
    closeAddSheet,
    openSettingsSheet,
    closeSettingsSheet,
    openActionSheet,
    closeActionSheet,

    // File Input Actions
    openFileDialog,
    clearFileInput,

    showDiffModal,
    diffPages,
    openDiffModal,
    closeDiffModal,
  }
}

// Export type for use in layouts
export type AppState = ReturnType<typeof useAppState>
