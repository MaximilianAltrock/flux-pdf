<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { useCommandManager } from '@/composables/useCommandManager'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useTheme } from '@/composables/useTheme'
import { DeletePagesCommand, RotatePagesCommand, DuplicatePagesCommand } from '@/commands'
import Toolbar from '@/components/Toolbar.vue'
import FileDropzone from '@/components/FileDropzone.vue'
import PageGrid from '@/components/PageGrid.vue'
import ExportModal from '@/components/ExportModal.vue'
import SourceSidebar from '@/components/SourceSidebar.vue'
import PagePreviewModal from '@/components/PagePreviewModal.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ZoomControl from '@/components/ZoomControl.vue'
import { FileText } from 'lucide-vue-next'
import type { PageReference } from '@/types'

const store = useDocumentStore()
const pdfManager = usePdfManager()
const { execute, undo, redo } = useCommandManager()
const toast = useToast()
const { confirmDelete } = useConfirm()

// Initialize theme
useTheme()

const fileInputRef = ref<HTMLInputElement | null>(null)
const showExportModal = ref(false)
const exportSelectedOnly = ref(false)
const showPreviewModal = ref(false)
const previewPageRef = ref<PageReference | null>(null)
const showCommandPalette = ref(false)

const hasPages = computed(() => store.pageCount > 0)

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

// Keyboard shortcuts
function handleKeyDown(event: KeyboardEvent) {
  const isInput = (event.target as HTMLElement).tagName === 'INPUT'

  // Ctrl/Cmd + K: Command palette
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
    return
  }

  // Don't process other shortcuts if command palette is open
  if (showCommandPalette.value) return

  // Ctrl/Cmd + Z: Undo
  if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    undo()
    return
  }

  // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
  if (
    (event.metaKey || event.ctrlKey) &&
    ((event.key === 'z' && event.shiftKey) || event.key === 'y')
  ) {
    event.preventDefault()
    redo()
    return
  }

  // Ctrl/Cmd + A: Select all
  if ((event.metaKey || event.ctrlKey) && event.key === 'a' && hasPages.value) {
    event.preventDefault()
    store.selectAll()
    return
  }

  // Don't process shortcuts below if in input field
  if (isInput) return

  // Space: Preview selected page
  if (event.key === ' ' && store.selectedCount === 1) {
    event.preventDefault()
    const selectedId = Array.from(store.selection.selectedIds)[0]
    const pageRef = store.pages.find((p) => p.id === selectedId)
    if (pageRef) {
      handlePagePreview(pageRef)
    }
    return
  }

  // Delete/Backspace: Delete selected (with confirmation)
  if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedCount > 0) {
    event.preventDefault()
    handleDeleteSelected()
    return
  }

  // R: Rotate right, Shift+R: Rotate left
  if (event.key === 'r' && !event.metaKey && !event.ctrlKey && store.selectedCount > 0) {
    event.preventDefault()
    const selectedIds = Array.from(store.selection.selectedIds)
    const degrees = event.shiftKey ? -90 : 90
    execute(new RotatePagesCommand(selectedIds, degrees))
    return
  }

  // D: Duplicate selected
  if (event.key === 'd' && !event.metaKey && !event.ctrlKey && store.selectedCount > 0) {
    event.preventDefault()
    handleDuplicateSelected()
    return
  }

  // Escape: Close modals or clear selection
  if (event.key === 'Escape') {
    if (showPreviewModal.value) {
      showPreviewModal.value = false
    } else if (showExportModal.value) {
      showExportModal.value = false
    } else {
      store.clearSelection()
    }
    return
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-background text-text">
    <!-- Hidden file input for toolbar -->
    <input
      ref="fileInputRef"
      type="file"
      accept="application/pdf,.pdf"
      multiple
      class="hidden"
      @change="handleFileInputChange"
    />

    <!-- Header -->
    <header class="bg-surface border-b border-border transition-colors duration-300">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <FileText class="w-8 h-8 text-primary" />
          <h1 class="text-xl font-bold text-text">FluxPDF</h1>
          <span class="text-sm text-text-muted">Fast PDF Editor</span>
        </div>
        <ThemeToggle />
      </div>
    </header>

    <!-- Toolbar -->
    <Toolbar
      @add-files="openFileDialog"
      @export="handleExport"
      @export-selected="handleExportSelected"
      @delete-selected="handleDeleteSelected"
    />

    <!-- Loading overlay -->
    <Transition name="fade">
      <div
        v-if="store.isLoading"
        class="absolute inset-0 bg-background/80 flex items-center justify-center z-40"
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
          <span class="text-text-muted">{{ store.loadingMessage }}</span>
        </div>
      </div>
    </Transition>

    <!-- Main content with sidebar -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar - only show when we have files -->
      <SourceSidebar v-if="hasPages" @remove-source="handleRemoveSource" />

      <!-- Main content -->
      <main class="flex-1 overflow-hidden">
        <!-- Empty state: Show dropzone -->
        <div v-if="!hasPages" class="h-full flex items-center justify-center p-8 bg-background">
          <div class="max-w-lg w-full">
            <FileDropzone @files-selected="handleFilesSelected" />

            <div class="mt-8 text-center">
              <h2 class="text-lg font-semibold text-text mb-2">
                Get started with FluxPDF
              </h2>
              <ul class="text-sm text-text-muted space-y-1">
                <li>📄 Merge multiple PDFs into one</li>
                <li>🔄 Reorder pages by dragging</li>
                <li>🗑️ Remove unwanted pages</li>
                <li>↻ Rotate pages</li>
              </ul>

              <div class="mt-6 pt-6 border-t border-border">
                <h3 class="text-sm font-medium text-text-muted mb-2">
                  Keyboard shortcuts
                </h3>
                <div
                  class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-muted"
                >
                  <span
                    ><kbd class="px-1.5 py-0.5 bg-surface rounded border border-border">Ctrl+K</kbd>
                    Commands</span
                  >
                  <span
                    ><kbd class="px-1.5 py-0.5 bg-surface rounded border border-border">Ctrl+Z</kbd>
                    Undo</span
                  >
                  <span
                    ><kbd class="px-1.5 py-0.5 bg-surface rounded border border-border">Space</kbd>
                    Preview</span
                  >
                  <span
                    ><kbd class="px-1.5 py-0.5 bg-surface rounded border border-border">R</kbd>
                    Rotate</span
                  >
                  <span
                    ><kbd class="px-1.5 py-0.5 bg-surface rounded border border-border">D</kbd>
                    Duplicate</span
                  >
                  <span
                    ><kbd class="px-1.5 py-0.5 bg-surface rounded border border-border">Del</kbd>
                    Delete</span
                  >
                </div>
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
      </main>
    </div>

    <!-- Footer -->
    <footer
      class="bg-surface border-t border-border px-4 py-2"
    >
      <div class="flex items-center justify-between text-xs text-muted">
        <span>FluxPDF v1.0.0</span>
        <div class="flex items-center gap-4">
          <!-- Zoom control - only show when we have pages -->
          <ZoomControl v-if="hasPages" />

          <span class="hidden sm:inline">
            <kbd
              class="px-1.5 py-0.5 bg-muted/20 rounded text-muted"
              >Ctrl+K</kbd
            >
            Command palette
          </span>
          <span class="hidden md:inline">All processing happens locally in your browser</span>
        </div>
      </div>
    </footer>

    <!-- Export Modal -->
    <ExportModal
      :open="showExportModal"
      :export-selected="exportSelectedOnly"
      @close="showExportModal = false"
      @success="handleExportSuccess"
    />

    <!-- Page Preview Modal -->
    <PagePreviewModal
      :open="showPreviewModal"
      :page-ref="previewPageRef"
      @close="showPreviewModal = false"
      @navigate="handlePreviewNavigate"
    />

    <!-- Command Palette -->
    <CommandPalette
      :open="showCommandPalette"
      @close="showCommandPalette = false"
      @action="handleCommandAction"
    />

    <!-- Toast Notifications -->
    <ToastContainer />

    <!-- Confirmation Dialog -->
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
