<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables'
import { useCommandManager } from '@/composables/useCommandManager'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useTheme } from '@/composables/useTheme'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMobile } from '@/composables/useMobile'
import { useFileHandler } from '@/composables/useFileHandler'
import { usePdfExport } from '@/composables/usePdfExport'
import { UserAction } from '@/types/actions'

import { RotatePagesCommand, DuplicatePagesCommand, DeletePagesCommand } from '@/commands'

// Desktop Components
import MicroHeader from '@/components/MicroHeader.vue'
import SourceRail from '@/components/SourceRail.vue'
import InspectorPanel from '@/components/InspectorPanel.vue'
import PageGrid from '@/components/PageGrid.vue'
import FileDropzone from '@/components/FileDropzone.vue'

// Mobile Components
import MobileTopBar from '@/components/MobileTopBar.vue'
import MobilePageGrid from '@/components/MobilePageGrid.vue'
import MobileBottomBar from '@/components/MobileBottomBar.vue'
import MobileFAB from '@/components/MobileFAB.vue'
import MobileMenuDrawer from '@/components/MobileMenuDrawer.vue'
import MobileTitleSheet from '@/components/MobileTitleSheet.vue'
import MobileAddSheet from '@/components/MobileAddSheet.vue'
import MobileActionSheet from '@/components/MobileActionSheet.vue'

// Shared Components
import ExportModal from '@/components/ExportModal.vue'
import PagePreviewModal from '@/components/PagePreviewModal.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

import type { PageReference } from '@/types'

const store = useDocumentStore()
const { initSession } = usePdfManager()
const { execute, clearHistory, undo, restoreHistory } = useCommandManager()
const toast = useToast()
const { confirmDelete, confirmClearWorkspace } = useConfirm()
const { isMobile, haptic, shareFile, canShareFiles } = useMobile()
const { handleFiles } = useFileHandler() // Use Composable
const { generateRawPdf } = usePdfExport() // Use Composable

// Initialize theme
useTheme()

// Desktop keyboard shortcuts
const showCommandPalette = ref(false)
useKeyboardShortcuts(() => {
  if (!isMobile.value) {
    showCommandPalette.value = !showCommandPalette.value
  }
})

// === Shared State ===
const fileInputRef = ref<HTMLInputElement | null>(null)
const showExportModal = ref(false)
const exportSelectedOnly = ref(false)
const showPreviewModal = ref(false)
const previewPageRef = ref<PageReference | null>(null)
const documentTitle = ref('flux-pdf-export')

// === Mobile State ===
const mobileSelectionMode = ref(false)
const showMenuDrawer = ref(false)
const showTitleSheet = ref(false)
const showAddSheet = ref(false)
const showActionSheet = ref(false)

// === Computed ===
const hasPages = computed(() => store.pageCount > 0)

// === File Handling ===
function openFileDialog() {
  fileInputRef.value?.click()
}

function handleFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    handleFiles(input.files)
    input.value = ''
  }
}

// === Export Handling ===
async function handleExport() {
  if (isMobile.value && canShareFiles.value) {
    await handleMobileExport()
  } else {
    exportSelectedOnly.value = false
    showExportModal.value = true
  }
}

async function handleMobileExport() {
  try {
    store.setLoading(true, 'Generating PDF...')

    const pagesToExport = store.pages.filter((p) => !p.isDivider)
    if (pagesToExport.length === 0) throw new Error('No pages to export')

    const filename = store.projectTitle || 'document'

    // DRY Export Logic: Use shared generator
    const pdfBytes = await generateRawPdf(pagesToExport, { compress: true })

    // Create File for sharing (fix types with cast)
    const file = new File([pdfBytes as any], `${filename}.pdf`, { type: 'application/pdf' })

    store.setLoading(false)

    const result = await shareFile(file, filename)
    if (result.shared) toast.success('Shared successfully')
    else if (result.downloaded) toast.success('PDF downloaded')
  } catch (error) {
    store.setLoading(false)
    toast.error('Export failed', error instanceof Error ? error.message : 'Export failed')
  }
}

function handleExportSelected() {
  exportSelectedOnly.value = true
  showExportModal.value = true
}

// === Page Actions ===
function handlePagePreview(pageRef: PageReference) {
  previewPageRef.value = pageRef
  showPreviewModal.value = true
}

async function handleDeleteSelected() {
  if (store.selectedCount === 0) return

  if (!isMobile.value) {
    const confirmed = await confirmDelete(store.selectedCount, 'page')
    if (!confirmed) return
  }

  const selectedIds = Array.from(store.selection.selectedIds)

  execute(new DeletePagesCommand(selectedIds))

  store.clearSelection()

  if (isMobile.value) {
    haptic('medium')
    mobileSelectionMode.value = false
  }

  toast.success(
    'Pages deleted',
    `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} removed`,
    // Actionable Toast
    { label: 'UNDO', onClick: () => undo() },
  )
}

function handleDuplicateSelected() {
  if (store.selectedCount === 0) return
  const selectedIds = Array.from(store.selection.selectedIds)
  execute(new DuplicatePagesCommand(selectedIds))
  if (isMobile.value) haptic('light')
  toast.success('Pages duplicated')
}

function handleRotateSelected(degrees: 90 | -90) {
  if (store.selectedCount === 0) return
  const selectedIds = Array.from(store.selection.selectedIds)
  execute(new RotatePagesCommand(selectedIds, degrees))
  if (isMobile.value) haptic('light')
}

// === Source Management ===
async function handleRemoveSource(sourceId: string) {
  const source = store.sources.get(sourceId)
  if (!source) return

  // In Hard Delete mode, removing source removes pages instantly.
  // We can't easily undo source removal in this MVP without a complex Command,
  // so we just warn the user.
  const pagesToRemove = store.pages.filter((p) => p.sourceFileId === sourceId).length

  if (!isMobile.value) {
    const confirmed = await confirmDelete(pagesToRemove, 'page')
    if (!confirmed) return
  }

  store.removeSourceFile(sourceId)
  toast.success('File removed')
}

async function handleNewProject() {
  const confirmed = await confirmClearWorkspace()
  if (!confirmed) return
  store.reset()
  clearHistory()
  toast.info('Workspace Cleared')
}

// === Action Handlers ===
function handleContextAction(action: string, pageRef: PageReference) {
  if (!store.selection.selectedIds.has(pageRef.id)) {
    store.selectPage(pageRef.id, false)
  }

  switch (action) {
    case UserAction.PREVIEW:
      handlePagePreview(pageRef)
      break
    case UserAction.DUPLICATE:
      handleDuplicateSelected()
      break
    case UserAction.ROTATE_LEFT:
      handleRotateSelected(-90)
      break
    case UserAction.ROTATE_RIGHT:
      handleRotateSelected(90)
      break
    case UserAction.SELECT_ALL:
      store.selectAll()
      break
    case UserAction.EXPORT_SELECTED:
      handleExportSelected()
      break
    case UserAction.DELETE:
      handleDeleteSelected()
      break
  }
}

function handleCommandAction(action: string) {
  showCommandPalette.value = false
  switch (action) {
    case UserAction.ADD_FILES:
      openFileDialog()
      break
    case UserAction.EXPORT:
      handleExport()
      break
    case UserAction.EXPORT_SELECTED:
      handleExportSelected()
      break
    case UserAction.DELETE:
      handleDeleteSelected()
      break
    case UserAction.DUPLICATE:
      handleDuplicateSelected()
      break
    case UserAction.NEW_PROJECT:
      handleNewProject()
      break
    case UserAction.PREVIEW:
      if (store.selectedCount === 1) {
        const id = Array.from(store.selection.selectedIds)[0]
        const p = store.pages.find((page) => page.id === id)
        if (p) handlePagePreview(p)
      }
      break
  }
}

// === Mobile Handlers ===
function handleMobileEnterSelection() {
  mobileSelectionMode.value = true
}
function handleMobileExitSelection() {
  mobileSelectionMode.value = false
  store.clearSelection()
}
function handleMobileAddFiles() {
  openFileDialog()
}
function handleMobileTakePhoto() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'
  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files
    if (files) handleFiles(files)
  }
  input.click()
}

// === Helpers ===
function zoomIn() {
  store.zoomIn()
}
function zoomOut() {
  store.zoomOut()
}

onMounted(async () => {
  // 1. Load Files & Page Grid
  await initSession()

  // 2. Load History Stack
  await restoreHistory()
})
</script>

<template>
  <div
    class="h-[100dvh] w-screen flex flex-col bg-background text-text overflow-hidden supports-[height:100dvh]:h-[100dvh]"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="application/pdf,.pdf,image/jpeg,image/png"
      multiple
      class="hidden"
      @change="handleFileInputChange"
    />

    <!-- MOBILE -->
    <template v-if="isMobile">
      <div class="pt-[env(safe-area-inset-top)]">
        <MobileTopBar
          :selection-mode="mobileSelectionMode"
          :selected-count="store.selectedCount"
          @menu="showMenuDrawer = true"
          @exit-selection="handleMobileExitSelection"
          @edit-title="showTitleSheet = true"
        />
      </div>

      <main class="flex-1 overflow-hidden relative">
        <div v-if="!hasPages" class="h-full flex flex-col items-center justify-center p-8">
          <div class="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <svg
              class="w-10 h-10 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-text mb-2">No PDFs yet</h2>
          <p class="text-text-muted text-center mb-6">Tap the + button to add your first PDF</p>
        </div>
        <MobilePageGrid
          v-else
          :selection-mode="mobileSelectionMode"
          @enter-selection="handleMobileEnterSelection"
          @exit-selection="handleMobileExitSelection"
          @preview="handlePagePreview"
        />
        <Transition name="fade">
          <div
            v-if="store.isLoading"
            class="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-50"
          >
            <svg class="w-12 h-12 text-primary animate-spin mb-4" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span class="text-text-muted font-medium">{{ store.loadingMessage }}</span>
          </div>
        </Transition>
      </main>

      <div class="pb-[env(safe-area-inset-bottom)]">
        <MobileBottomBar
          :selection-mode="mobileSelectionMode"
          :selected-count="store.selectedCount"
          :has-pages="hasPages"
          @rotate-left="handleRotateSelected(-90)"
          @rotate-right="handleRotateSelected(90)"
          @delete="handleDeleteSelected"
          @duplicate="handleDuplicateSelected"
          @export="handleExport"
        />
      </div>

      <MobileFAB
        :selection-mode="mobileSelectionMode"
        :selected-count="store.selectedCount"
        @add="showAddSheet = true"
        @actions="showActionSheet = true"
      />
      <MobileMenuDrawer
        :open="showMenuDrawer"
        @close="showMenuDrawer = false"
        @remove-source="handleRemoveSource"
      />
      <MobileTitleSheet :open="showTitleSheet" @close="showTitleSheet = false" />
      <MobileAddSheet
        :open="showAddSheet"
        @close="showAddSheet = false"
        @select-files="handleMobileAddFiles"
        @take-photo="handleMobileTakePhoto"
      />
      <MobileActionSheet
        :open="showActionSheet"
        :selected-count="store.selectedCount"
        @close="showActionSheet = false"
        @rotate-left="handleRotateSelected(-90)"
        @rotate-right="handleRotateSelected(90)"
        @duplicate="handleDuplicateSelected"
        @delete="handleDeleteSelected"
        @export-selected="handleExportSelected"
      />
    </template>

    <!-- DESKTOP -->
    <template v-else>
      <MicroHeader
        v-model:title="documentTitle"
        @command="showCommandPalette = true"
        @export="handleExport"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @new-project="handleNewProject"
      />
      <div class="flex-1 flex overflow-hidden">
        <SourceRail @remove-source="handleRemoveSource" />
        <main class="flex-1 overflow-hidden relative flex flex-col bg-background">
          <div v-if="!hasPages" class="h-full flex items-center justify-center p-8">
            <div class="max-w-lg w-full">
              <FileDropzone @files-selected="handleFiles" />
              <div class="mt-8 text-center text-text-muted">
                <p class="mb-4">Or drag files from your desktop</p>
                <div class="flex flex-wrap justify-center gap-2 text-xs opacity-70">
                  <span class="px-2 py-1 bg-surface rounded">CMD+K for commands</span>
                </div>
              </div>
            </div>
          </div>
          <PageGrid
            v-else
            @files-dropped="handleFiles"
            @preview="handlePagePreview"
            @context-action="handleContextAction"
          />
          <Transition name="fade">
            <div
              v-if="store.isLoading"
              class="absolute inset-0 bg-background/80 flex items-center justify-center z-50 backdrop-blur-sm"
            >
              <div class="flex flex-col items-center gap-3">
                <svg class="w-10 h-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span class="text-text-muted font-medium">{{ store.loadingMessage }}</span>
              </div>
            </div>
          </Transition>
        </main>
        <InspectorPanel
          @delete-selected="handleDeleteSelected"
          @duplicate-selected="handleDuplicateSelected"
        />
      </div>
      <CommandPalette
        :open="showCommandPalette"
        @close="showCommandPalette = false"
        @action="handleCommandAction"
      />
    </template>

    <ExportModal
      :open="showExportModal"
      :export-selected="exportSelectedOnly"
      @close="showExportModal = false"
      @success="() => toast.success('PDF Exported')"
    />
    <PagePreviewModal
      :open="showPreviewModal"
      :page-ref="previewPageRef"
      @close="showPreviewModal = false"
      @navigate="(p) => (previewPageRef = p)"
    />
    <ToastContainer />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
