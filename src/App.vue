<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { useCommandManager } from '@/composables/useCommandManager'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useTheme } from '@/composables/useTheme'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMobile } from '@/composables/useMobile'
import { RotatePagesCommand, DuplicatePagesCommand, AddPagesCommand } from '@/commands'

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
const pdfManager = usePdfManager()
const { execute, clearHistory } = useCommandManager()
const toast = useToast()
const { confirmDelete } = useConfirm()
const { isMobile, haptic, shareFile, canShareFiles } = useMobile()

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
    handleFilesSelected(input.files)
    input.value = ''
  }
}

async function handleFilesSelected(files: FileList) {
  // 1. Load blobs into memory (Pure IO, no store mutation yet)
  const results = await pdfManager.loadPdfFiles(files)

  const successes = results.filter((r) => r.success)
  const errors = results.filter((r) => !r.success)

  // 2. Execute Command for each successful file
  // This ensures the Source File AND Pages are added via the Command System (Undo/Redo compatible)
  if (successes.length > 0) {
    for (const result of successes) {
      if (result.sourceFile && result.pageRefs) {
        // Param 3 (true) = "Add this source file to the store logic too"
        // because loadPdfFiles no longer does it automatically.
        execute(new AddPagesCommand(result.sourceFile, result.pageRefs, true))
      }
    }

    const totalPages = successes.reduce((sum, r) => sum + (r.sourceFile?.pageCount ?? 0), 0)

    toast.success(
      `Added ${successes.length} file${successes.length > 1 ? 's' : ''}`,
      `${totalPages} page${totalPages > 1 ? 's' : ''} added`,
    )
  }

  // 3. Handle Errors
  if (errors.length > 0) {
    toast.error(
      `Failed to load ${errors.length} file${errors.length > 1 ? 's' : ''}`,
      errors.map((e) => e.error).join(', '),
    )
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

    // Generate PDF bytes using the export composable
    const { PDFDocument, degrees } = await import('pdf-lib')

    const pagesToExport = store.pages.filter((p) => !p.deleted && !p.isDivider)
    if (pagesToExport.length === 0) {
      toast.error('No pages to export')
      return
    }

    const finalPdf = await PDFDocument.create()
    finalPdf.setProducer('FluxPDF')
    finalPdf.setCreationDate(new Date())

    const loadedPdfs = new Map<string, any>()

    for (const pageRef of pagesToExport) {
      let sourcePdf = loadedPdfs.get(pageRef.sourceFileId)

      if (!sourcePdf) {
        const sourceBuffer = pdfManager.getPdfBlob(pageRef.sourceFileId)
        if (!sourceBuffer) {
          throw new Error(`Source file not found: ${pageRef.sourceFileId}`)
        }
        sourcePdf = await PDFDocument.load(sourceBuffer)
        loadedPdfs.set(pageRef.sourceFileId, sourcePdf)
      }

      const [copiedPage] = await finalPdf.copyPages(sourcePdf, [pageRef.sourcePageIndex])
      if (!copiedPage) throw new Error('Failed to copy page')

      if (pageRef.rotation !== 0) {
        const currentRotation = copiedPage.getRotation().angle
        copiedPage.setRotation(degrees(currentRotation + pageRef.rotation))
      }

      finalPdf.addPage(copiedPage)
    }

    const pdfBytes = await finalPdf.save({ useObjectStreams: true })
    // Re-wrap to ensure the underlying buffer is a plain ArrayBuffer for File constructor
    const exportBytes = new Uint8Array(pdfBytes)
    const filename = `${store.projectTitle || 'document'}.pdf`
    const file = new File([exportBytes], filename, { type: 'application/pdf' })

    store.setLoading(false)

    const result = await shareFile(file, store.projectTitle)

    if (result.shared) {
      toast.success('Shared successfully')
    } else if (result.downloaded) {
      toast.success('PDF downloaded')
    }
  } catch (error) {
    store.setLoading(false)
    const message = error instanceof Error ? error.message : 'Export failed'
    toast.error('Export failed', message)
    console.error('Mobile export error:', error)
  }
}

function handleExportSelected() {
  exportSelectedOnly.value = true
  showExportModal.value = true
}

function handleExportSuccess() {
  toast.success('PDF exported', 'Your file has been downloaded')
}

// === Page Actions ===
function handlePagePreview(pageRef: PageReference) {
  previewPageRef.value = pageRef
  showPreviewModal.value = true
}

function handlePreviewNavigate(pageRef: PageReference) {
  previewPageRef.value = pageRef
}

async function handleDeleteSelected() {
  if (store.selectedCount === 0) return

  if (!isMobile.value) {
    const confirmed = await confirmDelete(store.selectedCount, 'page')
    if (!confirmed) return
  }

  const selectedIds = Array.from(store.selection.selectedIds)
  store.softDeletePages(selectedIds)
  store.clearSelection()

  if (isMobile.value) {
    haptic('medium')
    mobileSelectionMode.value = false
  }

  toast.success(
    'Pages deleted',
    `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} removed`,
  )
}

function handleDuplicateSelected() {
  if (store.selectedCount === 0) return

  const selectedIds = Array.from(store.selection.selectedIds)
  execute(new DuplicatePagesCommand(selectedIds))

  if (isMobile.value) {
    haptic('light')
  }

  toast.success(
    'Pages duplicated',
    `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} duplicated`,
  )
}

function handleRotateSelected(degrees: 90 | -90) {
  if (store.selectedCount === 0) return

  const selectedIds = Array.from(store.selection.selectedIds)
  execute(new RotatePagesCommand(selectedIds, degrees))

  if (isMobile.value) {
    haptic('light')
  }
}

// === Source Management ===
async function handleRemoveSource(sourceId: string) {
  const source = store.sources.get(sourceId)
  if (!source) return

  const pagesToRemove = store.pages.filter((p) => p.sourceFileId === sourceId).length

  if (!isMobile.value) {
    const confirmed = await confirmDelete(pagesToRemove, 'page')
    if (!confirmed) return
  }

  pdfManager.removeSourceFile(sourceId)
  toast.success('File removed', `${pagesToRemove} page${pagesToRemove > 1 ? 's' : ''} removed`)
}

async function handleNewProject() {
  const confirmed = await useConfirm().confirmClearWorkspace()
  if (!confirmed) return

  // 1. Reset Store
  store.reset()
  // 2. Reset History Stack
  clearHistory()
  // 3. Reset PDF Manager (Memory Blobs)
  pdfManager.clearAll()

  toast.info('Workspace Cleared', 'Ready for new project')
}

// === Desktop Context Actions ===
function handleContextAction(action: string, pageRef: PageReference) {
  if (!store.selection.selectedIds.has(pageRef.id)) {
    store.selectPage(pageRef.id, false)
  }

  switch (action) {
    case 'preview':
      handlePagePreview(pageRef)
      break
    case 'duplicate':
      handleDuplicateSelected()
      break
    case 'rotate-left':
      execute(new RotatePagesCommand(Array.from(store.selection.selectedIds), -90))
      break
    case 'rotate-right':
      execute(new RotatePagesCommand(Array.from(store.selection.selectedIds), 90))
      break
    case 'select-all':
      store.selectAll()
      break
    case 'export-selected':
      handleExportSelected()
      break
    case 'delete':
      handleDeleteSelected()
      break
  }
}

// === Desktop Command Palette ===
function handleCommandAction(action: string) {
  showCommandPalette.value = false

  switch (action) {
    case 'add-files':
      openFileDialog()
      break
    case 'export':
      handleExport()
      break
    case 'export-selected':
      handleExportSelected()
      break
    case 'delete':
      handleDeleteSelected()
      break
    case 'duplicate':
      handleDuplicateSelected()
      break
    case 'new-project':
      handleNewProject()
      break
    case 'preview':
      if (store.selectedCount === 1) {
        const selectedId = Array.from(store.selection.selectedIds)[0]
        const pageRef = store.pages.find((p) => p.id === selectedId)
        if (pageRef) handlePagePreview(pageRef)
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

function handleMobileAddFiles(_insertAtEnd: boolean) {
  // For now, just open file dialog (insert position could be used with more complex logic)
  openFileDialog()
}

function handleMobileTakePhoto() {
  // Open file dialog with capture attribute
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'
  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files
    if (files && files.length > 0) {
      handleFilesSelected(files)
    }
  }
  input.click()
}

// === Desktop Helpers ===
function zoomIn() {
  store.zoomIn()
}

function zoomOut() {
  store.zoomOut()
}
</script>

<template>
  <div
    class="h-[100dvh] w-screen flex flex-col bg-background text-text overflow-hidden supports-[height:100dvh]:h-[100dvh]"
  >
    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="application/pdf,.pdf,image/jpeg,image/png"
      multiple
      class="hidden"
      @change="handleFileInputChange"
    />

    <!-- ============================================ -->
    <!-- MOBILE LAYOUT -->
    <!-- ============================================ -->
    <template v-if="isMobile">
      <!-- Top Bar -->
      <div class="pt-[env(safe-area-inset-top)]">
        <MobileTopBar
          :selection-mode="mobileSelectionMode"
          :selected-count="store.selectedCount"
          @menu="showMenuDrawer = true"
          @exit-selection="handleMobileExitSelection"
          @edit-title="showTitleSheet = true"
        />
      </div>

      <!-- Main Content -->
      <main class="flex-1 overflow-hidden relative">
        <!-- Empty State -->
        <div v-if="!hasPages" class="h-full flex flex-col items-center justify-center p-8">
          <div class="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <svg
              class="w-10 h-10 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-text mb-2">No PDFs yet</h2>
          <p class="text-text-muted text-center mb-6">Tap the + button to add your first PDF</p>
        </div>

        <!-- Page Grid -->
        <MobilePageGrid
          v-else
          :selection-mode="mobileSelectionMode"
          @enter-selection="handleMobileEnterSelection"
          @exit-selection="handleMobileExitSelection"
          @preview="handlePagePreview"
        />

        <!-- Loading Overlay -->
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

      <!-- Bottom Bar -->
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

      <!-- FAB -->
      <MobileFAB
        :selection-mode="mobileSelectionMode"
        :selected-count="store.selectedCount"
        @add="showAddSheet = true"
        @actions="showActionSheet = true"
      />

      <!-- Mobile Sheets & Drawers -->
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

    <!-- ============================================ -->
    <!-- DESKTOP LAYOUT -->
    <!-- ============================================ -->
    <template v-else>
      <!-- Micro-Header -->
      <MicroHeader
        v-model:title="documentTitle"
        @command="showCommandPalette = true"
        @export="handleExport"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @new-project="handleNewProject"
      />

      <!-- Main Workspace -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Left: Source Rail -->
        <SourceRail @remove-source="handleRemoveSource" />

        <!-- Center: Assembly Stage -->
        <main class="flex-1 overflow-hidden relative flex flex-col bg-background">
          <!-- Empty state -->
          <div v-if="!hasPages" class="h-full flex items-center justify-center p-8">
            <div class="max-w-lg w-full">
              <FileDropzone @files-selected="handleFilesSelected" />

              <div class="mt-8 text-center text-text-muted">
                <p class="mb-4">Or drag files from your desktop</p>
                <div class="flex flex-wrap justify-center gap-2 text-xs opacity-70">
                  <span class="px-2 py-1 bg-surface rounded">CMD+K for commands</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Page grid -->
          <PageGrid
            v-else
            @files-dropped="handleFilesSelected"
            @preview="handlePagePreview"
            @context-action="handleContextAction"
          />

          <!-- Loading overlay -->
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

        <!-- Right: Inspector -->
        <InspectorPanel
          @delete-selected="handleDeleteSelected"
          @duplicate-selected="handleDuplicateSelected"
        />
      </div>

      <!-- Desktop Command Palette -->
      <CommandPalette
        :open="showCommandPalette"
        @close="showCommandPalette = false"
        @action="handleCommandAction"
      />
    </template>

    <!-- ============================================ -->
    <!-- SHARED MODALS -->
    <!-- ============================================ -->
    <ExportModal
      :open="showExportModal"
      :export-selected="exportSelectedOnly"
      @close="showExportModal = false"
      @success="handleExportSuccess"
    />

    <PagePreviewModal
      :open="showPreviewModal"
      :page-ref="previewPageRef"
      @close="showPreviewModal = false"
      @navigate="handlePreviewNavigate"
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
