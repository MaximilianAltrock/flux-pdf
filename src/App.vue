<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { useCommandManager } from '@/composables/useCommandManager'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useTheme } from '@/composables/useTheme'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { RotatePagesCommand, DuplicatePagesCommand } from '@/commands'
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
const { execute, clearHistory } = useCommandManager()
const toast = useToast()
const { confirmDelete, confirmClearWorkspace } = useConfirm()

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

  // Show success toast (Type A: Efficiency Flex)
  if (successes.length > 0) {
    const totalPages = successes.reduce((sum, r) => sum + (r.sourceFile?.pageCount ?? 0), 0)
    const fileNames = successes.map((r) => r.sourceFile?.filename).join(', ')
    toast.success(
      `Added ${successes.length} file${successes.length > 1 ? 's' : ''}`,
      `${totalPages} page${totalPages > 1 ? 's' : ''} from "${fileNames}"`,
    )
  }

  // Show error toast (Type C: System Alert - requires manual dismiss)
  if (errors.length > 0) {
    for (const err of errors) {
      toast.warning('Import Failed', err.error || 'Unknown error')
    }
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
    // Store pages for undo
    const removedPages = store.pages
      .filter((p) => p.sourceFileId === sourceId)
      .map((p) => ({ ...p }))
    const sourceBackup = { ...source }

    pdfManager.removeSourceFile(sourceId)

    // Type B: Safety Net toast with UNDO
    toast.destructive(
      `Removed "${source.filename}"`,
      `${pagesToRemove} page${pagesToRemove > 1 ? 's' : ''} deleted`,
      () => {
        // Undo: restore source and pages
        store.addSourceFile(sourceBackup)
        store.addPages(removedPages)
      },
    )
  }
}

function handleExportSuccess(filename?: string, sizeKB?: number, durationMs?: number) {
  // Type A: Efficiency Flex - show speed to prove local-first USP
  const detail = filename
    ? `"${filename}" ${sizeKB ? `(${(sizeKB / 1024).toFixed(1)} MB)` : ''} ${durationMs ? `• ${durationMs}ms` : ''}`
    : undefined

  toast.success('Export Successful', detail)
}

async function handleDeleteSelected() {
  if (store.selectedCount === 0) return

  const selectedIds = Array.from(store.selection.selectedIds)
  const count = selectedIds.length

  // Store pages for undo before deleting
  const deletedPages = store.pages.filter((p) => selectedIds.includes(p.id)).map((p) => ({ ...p }))

  // Get source name for detail
  const sourceId = deletedPages[0]?.sourceFileId
  const source = sourceId ? store.sources.get(sourceId) : null
  const sourceDetail = source ? `From "${source.filename}"` : undefined

  store.softDeletePages(selectedIds)
  store.clearSelection()

  // Type B: Safety Net toast with UNDO
  toast.destructive(`Deleted ${count} Page${count > 1 ? 's' : ''}`, sourceDetail, () => {
    // Undo: restore the soft-deleted pages
    store.restorePages(selectedIds)
  })
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

  // Type D: Info toast (no undo needed - use command history)
  toast.info(
    'Pages Duplicated',
    `${selectedIds.length} page${selectedIds.length > 1 ? 's' : ''} copied`,
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

async function handleNewProject() {
  // If workspace is empty, reset immediately
  if (store.pageCount === 0 && store.sources.size === 0) {
    performReset()
    return
  }

  // Otherwise, show confirmation
  const confirmed = await confirmClearWorkspace()
  if (confirmed) {
    performReset()
  }
}

function performReset() {
  // Clear all PDF data and caches
  pdfManager.clearAll()
  // Clear command history
  clearHistory()
  // Reset title lock so next import sets the title
  store.isTitleLocked = false
  store.projectTitle = 'Untitled Project'
  // Type D: Info toast
  toast.info('Workspace Cleared', 'Ready for a new project')
}

function handleShowHelp() {
  // Open command palette - it shows keyboard shortcuts
  showCommandPalette.value = true
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
    case 'new-project':
      handleNewProject()
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
      @new-project="handleNewProject"
      @show-help="handleShowHelp"
    />

    <!-- Main Workspace (The Workbench) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Source Rail -->
      <SourceRail @remove-source="handleRemoveSource" />

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
