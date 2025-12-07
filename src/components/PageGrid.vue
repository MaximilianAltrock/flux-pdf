<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Scissors } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { ReorderPagesCommand, RotatePagesCommand, SplitGroupCommand, AddPagesCommand } from '@/commands'
import PdfThumbnail from './PdfThumbnail.vue'
import ContextMenu from './ContextMenu.vue'
import type { PageReference } from '@/types'

const emit = defineEmits<{
  filesDropped: [files: FileList]
  preview: [pageRef: PageReference]
  contextAction: [action: string, pageRef: PageReference]
}>()

const store = useDocumentStore()
const { execute } = useCommandManager()

// Local copy for drag operations - we don't want to create commands during drag
const localPages = ref<PageReference[]>([])
const isDragging = ref(false)
const draggingEnded = ref(false)
const dragStartOrder = ref<PageReference[]>([])
const isFileDragOver = ref(false)

// Context menu state
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  pageRef: null as PageReference | null,
  pageNumber: 0
})

// Sync local pages with store when store changes (but not during drag)
watch(
  () => store.pages,
  (newPages) => {
    if (!isDragging.value) {
      localPages.value = [...newPages]
    }
  },
  { deep: true, immediate: true }
)

// Dynamic grid style based on zoom
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${store.zoom + 20}px, 1fr))`
}))

function handlePageClick(pageRef: PageReference, event: MouseEvent) {
  // Close context menu on click
  contextMenu.value.visible = false

  if (store.currentTool === 'razor') {
    // Razor tool active: Split group at this page
    const index = store.pages.findIndex(p => p.id === pageRef.id)

    // Prevent splitting on first or last page, or if immediate predecessor is a divider
    const prevPage = store.pages[index - 1]
    if (index > 0 && index < store.pages.length - 1 && prevPage && !prevPage.isDivider) {
      execute(new SplitGroupCommand(index))
    }
    return // Don't select when splitting
  }

  if (event.metaKey || event.ctrlKey) {
    // Ctrl/Cmd + click: toggle selection
    store.togglePageSelection(pageRef.id)
  } else if (event.shiftKey && store.selection.lastSelectedId) {
    // Shift + click: range select
    store.selectRange(store.selection.lastSelectedId, pageRef.id)
  } else {
    // Normal click: toggle if only this page is selected, otherwise select it
    const isOnlySelected = store.selection.selectedIds.has(pageRef.id) && store.selectedCount === 1
    if (isOnlySelected) {
      store.clearSelection()
    } else {
      store.selectPage(pageRef.id, false)
    }
  }
}


function handlePageContextMenu(pageRef: PageReference, index: number, event: MouseEvent) {
  event.preventDefault()

  // Select the page if not already selected
  if (!store.selection.selectedIds.has(pageRef.id)) {
    store.selectPage(pageRef.id, false)
  }

  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    pageRef,
    pageNumber: index + 1
  }
}

function handleContextMenuAction(action: string) {
  if (contextMenu.value.pageRef) {
    emit('contextAction', action, contextMenu.value.pageRef)
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function handlePagePreview(pageRef: PageReference) {
  emit('preview', pageRef)
}

function handleRestore(pageRef: PageReference) {
  store.restorePages([pageRef.id])
}

function handleSoftDelete(pageRef: PageReference) {
  store.softDeletePages([pageRef.id])
}

function handleRotate(pageRef: PageReference) {
  execute(new RotatePagesCommand([pageRef.id], 90))
}

function isSelected(pageRef: PageReference): boolean {
  return store.selection.selectedIds.has(pageRef.id)
}

function handleDragStart() {
  isDragging.value = true
  contextMenu.value.visible = false
  // Save the order before dragging starts
  dragStartOrder.value = [...store.pages]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleDragEnd(_event: any) {
  isDragging.value = false

  // Check if order actually changed
  const orderChanged = localPages.value.some(
    (page, index) => page.id !== dragStartOrder.value[index]?.id
  )

  if (orderChanged) {
    // Create and execute a reorder command
    execute(new ReorderPagesCommand(dragStartOrder.value, localPages.value))
  }

  dragStartOrder.value = []

  // Fix stuck hover state: briefly disable pointer events to force hover recalculation
  draggingEnded.value = true
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      draggingEnded.value = false
    })
  })
}

// File drop handling
function handleFileDragOver(event: DragEvent) {
  event.preventDefault()

  // Accept both files and our internal source-file type
  if (event.dataTransfer?.types.includes('Files') || event.dataTransfer?.types.includes('application/json')) {
    isFileDragOver.value = true
  }
}

function handleFileDragLeave(event: DragEvent) {
  event.preventDefault()
  isFileDragOver.value = false
}

async function handleFileDrop(event: DragEvent) {
  event.preventDefault()
  isFileDragOver.value = false

  // check for internal source drop
  const jsonData = event.dataTransfer?.getData('application/json')
  if (jsonData) {
    try {
      const data = JSON.parse(event.dataTransfer?.getData('application/json') || '{}')
      if (data.type === 'source-file' && data.sourceId) {

        // Find source file metadata
        const sourceFile = store.sources.get(data.sourceId)
        if (!sourceFile) return

        // Generate NEW page references for the entire file
        const groupId = crypto.randomUUID()
        const newPages: PageReference[] = []

        for (let i = 0; i < sourceFile.pageCount; i++) {
            newPages.push({
                id: crypto.randomUUID(),
                sourceFileId: sourceFile.id,
                sourcePageIndex: i,
                rotation: 0,
                groupId,
                isDivider: false
            })
        }

        // Use Command for Undo/Redo support, passing false for shouldAddSource (since it's already in Library)
        execute(new AddPagesCommand(sourceFile, newPages, false))
        return
      }
    } catch {
      // ignore json parse error
    }
  }

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    emit('filesDropped', files)
  }
}
</script>

<template>
  <div
    class="h-full overflow-auto p-6 relative bg-background bg-grid-pattern"
    @dragover="handleFileDragOver"
    @dragleave="handleFileDragLeave"
    @drop="handleFileDrop"
  >
    <!-- File drop overlay -->
    <Transition name="fade">
      <div
        v-if="isFileDragOver"
        class="absolute inset-0 z-20 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none"
      >
        <div class="bg-surface rounded-lg shadow-lg px-6 py-4 text-center">
          <p class="text-lg font-medium text-primary">Drop files to append</p>
        </div>
      </div>
    </Transition>

    <VueDraggable
      v-model="localPages"
      :animation="200"
      ghost-class="sortable-ghost"
      drag-class="sortable-drag"
      chosen-class="sortable-chosen"
      class="grid gap-4 min-h-[50vh] pb-20"
      :class="{
        'razor-mode': store.currentTool === 'razor',
        'pointer-events-none': draggingEnded
      }"
      :style="gridStyle"
      @start="handleDragStart"
      @end="handleDragEnd"
    >
      <template v-for="(pageRef, index) in localPages" :key="pageRef.id">

        <!-- DIVIDER OBJECT (The Cut) -->
        <div
          v-if="pageRef.isDivider"
          class="col-span-full h-8 flex items-center gap-4 py-2 my-2 group/divider select-none"
        >
          <div class="h-px flex-1 bg-border group-hover/divider:bg-danger/40 transition-colors"></div>
           <div class="flex items-center gap-2 text-xs font-mono font-bold text-text-muted/50 uppercase tracking-widest group-hover/divider:text-danger/70 transition-colors">
              <Scissors class="w-3 h-3" />
              <span>New Document Section</span>
          </div>
          <div class="h-px flex-1 bg-border group-hover/divider:bg-danger/40 transition-colors"></div>
        </div>

        <!-- Normal Page Thumbnail -->
        <PdfThumbnail
          v-else
          :page-ref="pageRef"
          :page-number="index + 1"
          :selected="isSelected(pageRef)"
          :width="store.zoom"
          :is-start-of-file="index === 0 || (!localPages[index-1]?.isDivider && pageRef.groupId !== localPages[index - 1]?.groupId)"
          :is-razor-active="store.currentTool === 'razor'"
          :can-split="index > 0 && !localPages[index - 1]?.isDivider"
          @click="handlePageClick(pageRef, $event)"
          @preview="handlePagePreview(pageRef)"
          @contextmenu="handlePageContextMenu(pageRef, index, $event)"
          @restore="handleRestore(pageRef)"
          @delete="handleSoftDelete(pageRef)"
          @rotate="handleRotate(pageRef)"
        />
      </template>
    </VueDraggable>

    <!-- Help text -->
    <p
      v-if="localPages.length > 0"
      class="text-center text-sm text-text-muted mt-6"
    >
      Drag to reorder • Double-click to preview • Right-click for more options
    </p>

    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :selected-count="store.selectedCount"
      :page-number="contextMenu.pageNumber"
      @close="closeContextMenu"
      @action="handleContextMenuAction"
    />
  </div>
</template>

<style scoped>
.bg-grid-pattern {
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Razor/Split tool mode - scissor cursor */
.razor-mode {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cline x1='20' y1='4' x2='8.12' y2='15.88'/%3E%3Cline x1='14.47' y1='14.48' x2='20' y2='20'/%3E%3Cline x1='8.12' y1='8.12' x2='12' y2='12'/%3E%3C/svg%3E") 12 12, crosshair;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Drag & Drop Animations */
.sortable-ghost {
  opacity: 0.3;
  transform: scale(0.95);
  filter: grayscale(1);
}

.sortable-drag {
  opacity: 1 !important;
  transform: scale(1.05) !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3) !important;
  z-index: 50;
  cursor: grabbing !important;
}
</style>
