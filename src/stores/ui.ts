import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { PROGRESS, ZOOM } from '@/constants'
import type { PageReference } from '@/types'
import type { DocumentErrorCode } from '@/types/errors'

export type JobStatus = 'idle' | 'running' | 'success' | 'error'

export interface JobState {
  status: JobStatus
  progress: number
  error: string | null
  errorCode?: DocumentErrorCode | null
}

export function createJobState(): JobState {
  return {
    status: 'idle',
    progress: PROGRESS.MIN,
    error: null,
    errorCode: null,
  }
}

/**
 * UI Store
 * Centralized UI-only state (modals, sheets, zoom, tool selection, loading).
 */
export const useUiStore = defineStore('ui', () => {
  // ============================================
  // UI-only Document State
  // ============================================
  const isLoading = shallowRef(false)
  const loadingMessage = shallowRef('')

  const zoom = shallowRef<number>(ZOOM.DEFAULT)

  const zoomPercentage = computed(() =>
    Math.round((zoom.value / ZOOM.PERCENT_BASE) * ZOOM.PERCENT_MAX),
  )

  const currentTool = shallowRef<'select' | 'razor'>('select')
  const inspectorTab = shallowRef<'structure' | 'metadata' | 'security'>('structure')

  // ============================================
  // Desktop State
  // ============================================
  const showCommandPalette = shallowRef(false)
  const showPreflightPanel = shallowRef(false)

  // ============================================
  // Mobile State
  // ============================================
  const mobileSelectionMode = shallowRef(false)
  const mobileMoveMode = shallowRef(false)
  const showMenuDrawer = shallowRef(false)
  const showTitleSheet = shallowRef(false)
  const showAddSheet = shallowRef(false)
  const showSettingsSheet = shallowRef(false)
  const showActionSheet = shallowRef(false)

  // Mobile mode computed (Browse | Select | Move)
  const mobileMode = computed(() => {
    if (mobileMoveMode.value) return 'move' as const
    if (mobileSelectionMode.value) return 'select' as const
    return 'browse' as const
  })

  // ============================================
  // Shared Modal State
  // ============================================
  const showExportModal = shallowRef(false)
  const exportSelectedOnly = shallowRef(false)
  const showPreviewModal = shallowRef(false)
  const previewPageRef = ref<PageReference | null>(null)
  const showDiffModal = shallowRef(false)
  const diffPages = ref<[PageReference, PageReference] | null>(null)

  // Preflight (per-project)
  const ignoredPreflightRuleIds = ref<string[]>([])

  // Jobs (import/export)
  const importJob = ref<JobState>(createJobState())
  const exportJob = ref<JobState>(createJobState())

  // Track if any modal is open (for blocking global shortcuts)
  const hasOpenModal = computed(
    () =>
      showExportModal.value ||
      showPreviewModal.value ||
      showDiffModal.value ||
      showCommandPalette.value ||
      showSettingsSheet.value ||
      showPreflightPanel.value,
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

  function setInspectorTab(tab: 'structure' | 'metadata' | 'security') {
    inspectorTab.value = tab
  }

  function openCommandPalette() {
    showCommandPalette.value = true
  }

  function closeCommandPalette() {
    showCommandPalette.value = false
  }

  function toggleCommandPalette() {
    showCommandPalette.value = !showCommandPalette.value
  }

  function openPreflightPanel() {
    showPreflightPanel.value = true
  }

  function closePreflightPanel() {
    showPreflightPanel.value = false
  }

  function togglePreflightPanel() {
    showPreflightPanel.value = !showPreflightPanel.value
  }

  function openExportModal(selectedOnly = false) {
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

  function setIgnoredPreflightRuleIds(ids: string[]) {
    ignoredPreflightRuleIds.value = Array.from(new Set(ids))
  }

  function ignorePreflightRule(ruleId: string) {
    if (!ruleId) return
    if (ignoredPreflightRuleIds.value.includes(ruleId)) return
    ignoredPreflightRuleIds.value = [...ignoredPreflightRuleIds.value, ruleId]
  }

  function resetIgnoredPreflightRules() {
    ignoredPreflightRuleIds.value = []
  }

  // ============================================
  // Mobile State Management
  // ============================================
  function enterMobileSelectionMode() {
    mobileSelectionMode.value = true
  }

  function exitMobileSelectionMode() {
    mobileMoveMode.value = false
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

  return {
    // UI Document State
    isLoading,
    loadingMessage,
    zoom,
    zoomPercentage,
    currentTool,
    inspectorTab,

    // Desktop State
    showCommandPalette,
    showPreflightPanel,

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
    showDiffModal,
    diffPages,
    ignoredPreflightRuleIds,

    // Jobs
    importJob,
    exportJob,

    // Computed
    hasOpenModal,

    // Desktop Actions
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
    openPreflightPanel,
    closePreflightPanel,
    togglePreflightPanel,

    // UI Document Actions
    setLoading,
    setZoom,
    zoomIn,
    zoomOut,
    setCurrentTool,
    setInspectorTab,

    // Export Modal Actions
    openExportModal,
    closeExportModal,

    // Preview Modal Actions
    openPreviewModal,
    closePreviewModal,
    navigatePreview,

    // Diff Modal Actions
    openDiffModal,
    closeDiffModal,

    // Preflight
    setIgnoredPreflightRuleIds,
    ignorePreflightRule,
    resetIgnoredPreflightRules,

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

  }
})
