<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { useThumbnailZoom } from '@/composables/useThumbnailZoom'
import { ReorderPagesCommand } from '@/commands'
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
const { zoomLevel, gridColumnSize } = useThumbnailZoom()

// Local copy for drag operations - we don't want to create commands during drag
const localPages = ref<PageReference[]>([])
const isDragging = ref(false)
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
  gridTemplateColumns: `repeat(auto-fill, minmax(${gridColumnSize.value}, 1fr))`
}))

function handlePageClick(pageRef: PageReference, event: MouseEvent) {
  // Close context menu on click
  contextMenu.value.visible = false
  
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

function isSelected(pageRef: PageReference): boolean {
  return store.selection.selectedIds.has(pageRef.id)
}

function handleDragStart() {
  isDragging.value = true
  contextMenu.value.visible = false
  // Save the order before dragging starts
  dragStartOrder.value = [...store.pages]
}

function handleDragEnd() {
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
}

// File drop handling
function handleFileDragOver(event: DragEvent) {
  event.preventDefault()
  
  // Check if dragging files (not internal drag)
  if (event.dataTransfer?.types.includes('Files')) {
    isFileDragOver.value = true
  }
}

function handleFileDragLeave(event: DragEvent) {
  event.preventDefault()
  isFileDragOver.value = false
}

function handleFileDrop(event: DragEvent) {
  event.preventDefault()
  isFileDragOver.value = false
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    emit('filesDropped', files)
  }
}
</script>

<template>
  <div 
    class="h-full overflow-auto p-6 relative dark:bg-gray-900"
    @dragover="handleFileDragOver"
    @dragleave="handleFileDragLeave"
    @drop="handleFileDrop"
  >
    <!-- File drop overlay -->
    <Transition name="fade">
      <div 
        v-if="isFileDragOver"
        class="absolute inset-0 z-20 bg-flux-500/10 border-2 border-dashed border-flux-500 rounded-lg flex items-center justify-center pointer-events-none"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg px-6 py-4 text-center">
          <p class="text-lg font-medium text-flux-700 dark:text-flux-400">Drop PDF files here</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Files will be added to the document</p>
        </div>
      </div>
    </Transition>
    
    <VueDraggable
      v-model="localPages"
      :animation="200"
      ghost-class="sortable-ghost"
      drag-class="sortable-drag"
      chosen-class="sortable-chosen"
      class="grid gap-4"
      :style="gridStyle"
      @start="handleDragStart"
      @end="handleDragEnd"
    >
      <PdfThumbnail
        v-for="(pageRef, index) in localPages"
        :key="pageRef.id"
        :page-ref="pageRef"
        :page-number="index + 1"
        :selected="isSelected(pageRef)"
        :width="zoomLevel"
        @click="handlePageClick(pageRef, $event)"
        @preview="handlePagePreview(pageRef)"
        @contextmenu="handlePageContextMenu(pageRef, index, $event)"
      />
    </VueDraggable>
    
    <!-- Help text -->
    <p 
      v-if="localPages.length > 0"
      class="text-center text-sm text-gray-400 dark:text-gray-500 mt-6"
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
