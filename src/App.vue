<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { useCommandManager } from '@/composables/useCommandManager'
import { DeletePagesCommand, RotatePagesCommand } from '@/commands'
import Toolbar from '@/components/Toolbar.vue'
import FileDropzone from '@/components/FileDropzone.vue'
import PageGrid from '@/components/PageGrid.vue'
import ExportModal from '@/components/ExportModal.vue'
import SourceSidebar from '@/components/SourceSidebar.vue'
import { FileText } from 'lucide-vue-next'

const store = useDocumentStore()
const pdfManager = usePdfManager()
const { execute, undo, redo } = useCommandManager()

const fileInputRef = ref<HTMLInputElement | null>(null)
const errorMessage = ref<string | null>(null)
const showExportModal = ref(false)
const exportSelectedOnly = ref(false)

const hasPages = computed(() => store.pageCount > 0)

async function handleFilesSelected(files: FileList) {
  errorMessage.value = null

  const results = await pdfManager.loadPdfFiles(files)

  // Check for errors
  const errors = results.filter((r) => !r.success)
  if (errors.length > 0) {
    errorMessage.value = errors.map((e) => e.error).join(', ')
    // Clear error after 5 seconds
    setTimeout(() => {
      errorMessage.value = null
    }, 5000)
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

function handleRemoveSource(sourceId: string) {
  pdfManager.removeSourceFile(sourceId)
}

// Keyboard shortcuts
function handleKeyDown(event: KeyboardEvent) {
  const isInput = (event.target as HTMLElement).tagName === 'INPUT'

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

  // Delete/Backspace: Delete selected
  if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedCount > 0) {
    event.preventDefault()
    const selectedIds = Array.from(store.selection.selectedIds)
    execute(new DeletePagesCommand(selectedIds))
    store.clearSelection()
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

  // Escape: Clear selection or close modal
  if (event.key === 'Escape') {
    if (showExportModal.value) {
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
  <div class="h-screen flex flex-col bg-gray-50">
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
    <header class="bg-white border-b border-gray-200">
      <div class="flex items-center gap-3 px-4 py-3">
        <FileText class="w-8 h-8 text-flux-500" />
        <h1 class="text-xl font-bold text-gray-900">FluxPDF</h1>
        <span class="text-sm text-gray-400">Fast PDF Editor</span>
      </div>
    </header>

    <!-- Toolbar -->
    <Toolbar
      @add-files="openFileDialog"
      @export="handleExport"
      @export-selected="handleExportSelected"
    />

    <!-- Error toast -->
    <Transition name="fade">
      <div
        v-if="errorMessage"
        class="absolute top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg"
      >
        {{ errorMessage }}
      </div>
    </Transition>

    <!-- Loading overlay -->
    <Transition name="fade">
      <div
        v-if="store.isLoading"
        class="absolute inset-0 bg-white/80 flex items-center justify-center z-40"
      >
        <div class="flex flex-col items-center gap-3">
          <svg class="w-10 h-10 text-flux-500 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <span class="text-gray-600">{{ store.loadingMessage }}</span>
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
        <div v-if="!hasPages" class="h-full flex items-center justify-center p-8">
          <div class="max-w-lg w-full">
            <FileDropzone @files-selected="handleFilesSelected" />

            <div class="mt-8 text-center">
              <h2 class="text-lg font-semibold text-gray-700 mb-2">Get started with FluxPDF</h2>
              <ul class="text-sm text-gray-500 space-y-1">
                <li>📄 Merge multiple PDFs into one</li>
                <li>🔄 Reorder pages by dragging</li>
                <li>🗑️ Remove unwanted pages</li>
                <li>↻ Rotate pages</li>
              </ul>

              <div class="mt-6 pt-6 border-t border-gray-200">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Keyboard shortcuts</h3>
                <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded">Ctrl+Z</kbd> Undo</span>
                  <span
                    ><kbd class="px-1.5 py-0.5 bg-gray-100 rounded">Ctrl+Shift+Z</kbd> Redo</span
                  >
                  <span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded">R</kbd> Rotate</span>
                  <span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded">Del</kbd> Delete</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Page grid -->
        <PageGrid v-else />
      </main>
    </div>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 px-4 py-2">
      <div class="flex items-center justify-between text-xs text-gray-400">
        <span>FluxPDF v1.0.0</span>
        <span>All processing happens locally in your browser</span>
      </div>
    </footer>

    <!-- Export Modal -->
    <ExportModal
      :open="showExportModal"
      :export-selected="exportSelectedOnly"
      @close="showExportModal = false"
    />
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
