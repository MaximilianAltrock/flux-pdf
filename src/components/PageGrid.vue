<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { ReorderPagesCommand } from '@/commands'
import PdfThumbnail from './PdfThumbnail.vue'
import type { PageReference } from '@/types'

const store = useDocumentStore()
const { execute } = useCommandManager()

// Local copy for drag operations - we don't want to create commands during drag
const localPages = ref<PageReference[]>([])
const isDragging = ref(false)
const dragStartOrder = ref<PageReference[]>([])

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

function handlePageClick(pageRef: PageReference, event: MouseEvent) {
  if (event.metaKey || event.ctrlKey) {
    // Ctrl/Cmd + click: toggle selection
    store.togglePageSelection(pageRef.id)
  } else if (event.shiftKey && store.selection.lastSelectedId) {
    // Shift + click: range select
    store.selectRange(store.selection.lastSelectedId, pageRef.id)
  } else {
    // Normal click: single select
    store.selectPage(pageRef.id, false)
  }
}

function isSelected(pageRef: PageReference): boolean {
  return store.selection.selectedIds.has(pageRef.id)
}

function handleDragStart() {
  isDragging.value = true
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
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <VueDraggable
      v-model="localPages"
      :animation="200"
      ghost-class="sortable-ghost"
      drag-class="sortable-drag"
      chosen-class="sortable-chosen"
      class="grid gap-4"
      style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));"
      @start="handleDragStart"
      @end="handleDragEnd"
    >
      <PdfThumbnail
        v-for="(pageRef, index) in localPages"
        :key="pageRef.id"
        :page-ref="pageRef"
        :page-number="index + 1"
        :selected="isSelected(pageRef)"
        @click="handlePageClick(pageRef, $event)"
      />
    </VueDraggable>
    
    <!-- Help text -->
    <p 
      v-if="localPages.length > 0"
      class="text-center text-sm text-gray-400 mt-6"
    >
      Drag pages to reorder • Click to select • Ctrl+Click for multi-select • Shift+Click for range
    </p>
  </div>
</template>
