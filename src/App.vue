<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { useCommandManager } from '@/composables/useCommandManager'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useTheme } from '@/composables/useTheme'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { DeletePagesCommand, RotatePagesCommand, DuplicatePagesCommand } from '@/commands'
import MicroHeader from '@/components/MicroHeader.vue'
import SourceRail from '@/components/SourceRail.vue'
import InspectorPanel from '@/components/InspectorPanel.vue'
import PageGrid from '@/components/PageGrid.vue'
import ExportModal from '@/components/ExportModal.vue'
import PagePreviewModal from '@/components/PagePreviewModal.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FileDropzone from '@/components/FileDropzone.vue'
import type { PageReference } from '@/types'

const store = useDocumentStore()
const pdfManager = usePdfManager()
const { execute } = useCommandManager()
const toast = useToast()
const { confirmDelete } = useConfirm()

// Initialize theme
useTheme()

// Initialize global keyboard shortcuts
useKeyboardShortcuts(() => {
  showCommandPalette.value = !showCommandPalette.value
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const showExportModal = ref(false)
const exportSelectedOnly = ref(false)
const showPreviewModal = ref(false)
const previewPageRef = ref<PageReference | null>(null)
const showCommandPalette = ref(false)

const documentTitle = ref('flux-pdf-export')
const hasPages = computed(() => store.pageCount > 0)

function zoomIn() {
  store.zoomIn()
}

function zoomOut() {
  store.zoomOut()
}

async function handleFilesSelected(files: FileList) {
  const results = await pdfManager.loadPdfFiles(files)

  // Count successes and errors
  const successes = results.filter((r) => r.success)
  const errors = results.filter((r) => !r.success)

  // Show success toast
  if (successes.length > 0) {
    const totalPages = successes.reduce((sum, r) => sum + (r.sourceFile?.pageCount ?? 0), 0)
    toast.success(
      `Added ${successes.length} file${successes.length > 1 ? 's' : ''}`,
      `${totalPages} page${totalPages > 1 ? 's' : ''} added to document`,
    )
  }

  // Show error toast for failures
  if (errors.length > 0) {
    toast.error(
      `Failed to load ${errors.length} file${errors.length > 1 ? 's' : ''}`,
      errors.map((e) => e.error).join(', '),
    )
  }
}

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

async function handleExport() {
  exportSelectedOnly.value = false
  showExportModal.value = true
}

function handleExportSelected() {
  exportSelectedOnly.value = true
  showExportModal.value = true
}

async function handleRemoveSource(sourceId: string) {
  // Get source info for confirmation message
  const source = store.sources.get(sourceId)
  if (!source) return

  // Count pages that will be removed
  const pagesToRemove = store.pages.filter((p) => p.sourceFileId === sourceId).length

  const confirmed = await confirmDelete(pagesToRemove, 'page')
  if (confirmed) {
    pdfManager.removeSourceFile(sourceId)
    toast.success('File removed', `${pagesToRemove} page${pagesToRemove > 1 ? 's' : ''} removed`)
  }
}

function handleExportSuccess() {
  toast.success('PDF exported', 'Your file has been downloaded')
}

async function handleDeleteSelected() {
  if (store.selectedCount === 0) return

  const confirmed = await confirmDelete(store.selectedCount, 'page')
  if (confirmed) {
    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new DeletePagesCommand(selectedIds))
    store.clearSelection()
    toast.success(
      'Pages deleted',
      `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} removed`,
    )
  }
}

function handlePagePreview(pageRef: PageReference) {
  previewPageRef.value = pageRef
  showPreviewModal.value = true
}

function handlePreviewNavigate(pageRef: PageReference) {
  previewPageRef.value = pageRef
}

function handleDuplicateSelected() {
  if (store.selectedCount === 0) return

  const selectedIds = Array.from(store.selection.selectedIds)
  execute(new DuplicatePagesCommand(selectedIds))
  toast.success(
    'Pages duplicated',
    `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} duplicated`,
  )
}

function handleContextAction(action: string, pageRef: PageReference) {
  // Ensure the page is selected
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
    case 'preview':
      // Preview the first selected page
      if (store.selectedCount === 1) {
        const selectedId = Array.from(store.selection.selectedIds)[0]
        const pageRef = store.pages.find((p) => p.id === selectedId)
        if (pageRef) {
          handlePagePreview(pageRef)
        }
      }
      break
  }
}

// Old keyboard shortcuts removed in favor of useKeyboardShortcuts composable
</script>

<template>
  <div class="h-screen flex flex-col bg-background text-text overflow-hidden">
    <!-- Hidden file input for file loading -->
    <input
      ref="fileInputRef"
      type="file"
      accept="application/pdf,.pdf"
      multiple
      class="hidden"
      @change="handleFileInputChange"
    />

    <!-- Micro-Header -->
    <MicroHeader
      v-model:title="documentTitle"
      @command="showCommandPalette = true"
      @export="handleExport"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
    />

    <!-- Main Workspace (The Workbench) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Source Rail -->
      <SourceRail
        @remove-source="handleRemoveSource"
      />

      <!-- Center: Assembly Stage (Canvas) -->
      <main class="flex-1 overflow-hidden relative flex flex-col bg-background">
        <!-- Empty state: Show dropzone -->
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

      <!-- Right: Inspector & History -->
      <InspectorPanel
        @delete-selected="handleDeleteSelected"
        @duplicate-selected="handleDuplicateSelected"
      />
    </div>

    <!-- Modals -->
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

    <CommandPalette
      :open="showCommandPalette"
      @close="showCommandPalette = false"
      @action="handleCommandAction"
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
