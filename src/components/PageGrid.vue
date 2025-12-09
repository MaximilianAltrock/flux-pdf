<script setup lang="ts">
import { ref, computed } from 'vue'
import { Scissors } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import { useCommandManager } from '@/composables/useCommandManager'
import { useGridLogic } from '@/composables/useGridLogic'
import {
  ReorderPagesCommand,
  RotatePagesCommand,
  SplitGroupCommand,
  AddPagesCommand,
  DeletePagesCommand,
} from '@/commands'
import PdfThumbnail from './PdfThumbnail.vue'
import ContextMenu from './ContextMenu.vue'
import type { PageReference } from '@/types'
import { UserAction } from '@/types/actions'

// FIX: defineEmits cannot use computed keys ([UserAction.PREVIEW])
// We must use the string literal 'preview' here.
const emit = defineEmits<{
  filesDropped: [files: FileList]
  preview: [pageRef: PageReference]
  contextAction: [action: UserAction, pageRef: PageReference]
}>()

const { execute } = useCommandManager()
const { localPages, isDragging, isSelected, store } = useGridLogic()

// Local state for drag logic
const draggingEnded = ref(false)
const dragStartOrder = ref<PageReference[]>([])
const isFileDragOver = ref(false)

// Context menu state
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  pageRef: null as PageReference | null,
  pageNumber: 0,
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${store.zoom + 20}px, 1fr))`,
}))

// === Event Handlers ===

function handlePageClick(pageRef: PageReference, event: MouseEvent) {
  contextMenu.value.visible = false

  if (store.currentTool === 'razor') {
    const index = store.pages.findIndex((p) => p.id === pageRef.id)
    const prevPage = store.pages[index - 1]

    // Prevent invalid splits
    if (index > 0 && index < store.pages.length - 1 && prevPage && !prevPage.isDivider) {
      execute(new SplitGroupCommand(index))
    }
    return
  }

  // Selection Logic
  if (event.metaKey || event.ctrlKey) {
    store.togglePageSelection(pageRef.id)
  } else if (event.shiftKey && store.selection.lastSelectedId) {
    store.selectRange(store.selection.lastSelectedId, pageRef.id)
  } else {
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

  if (!store.selection.selectedIds.has(pageRef.id)) {
    store.selectPage(pageRef.id, false)
  }

  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    pageRef,
    pageNumber: index + 1,
  }
}

function handleContextMenuAction(action: string) {
  if (contextMenu.value.pageRef) {
    // Cast string to Enum to maintain strict typing upstream
    emit('contextAction', action as UserAction, contextMenu.value.pageRef)
  }
}

// === Drag & Drop (Reordering) ===

function handleDragStart() {
  isDragging.value = true
  contextMenu.value.visible = false
  dragStartOrder.value = [...store.pages]
}

function handleDragEnd() {
  isDragging.value = false

  const orderChanged = localPages.value.some(
    (page, index) => page.id !== dragStartOrder.value[index]?.id,
  )

  if (orderChanged) {
    execute(new ReorderPagesCommand(dragStartOrder.value, localPages.value))
  }

  dragStartOrder.value = []

  // Fix hover state sticking
  draggingEnded.value = true
  requestAnimationFrame(() => {
    draggingEnded.value = false
  })
}

// === Page Actions ===

function handlePreview(pageRef: PageReference) {
  // We can still use the Enum value when emitting, as it evaluates to 'preview' at runtime
  emit(UserAction.PREVIEW, pageRef)
}

function handleDelete(pageRef: PageReference) {
  execute(new DeletePagesCommand([pageRef.id]))
}

function handleRotate(pageRef: PageReference) {
  execute(new RotatePagesCommand([pageRef.id], 90))
}

// === File Drop (Ingestion) ===

function handleFileDragOver(event: DragEvent) {
  event.preventDefault()
  if (
    event.dataTransfer?.types.includes('Files') ||
    event.dataTransfer?.types.includes('application/json')
  ) {
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

  // 1. Check for Internal Reorder/Move (via Drag)
  const jsonData = event.dataTransfer?.getData('application/json')
  if (jsonData) {
    try {
      const data = JSON.parse(jsonData)
      // If user drags a source file from Left Sidebar -> Grid
      if (data.type === 'source-file' && data.sourceId) {
        const sourceFile = store.sources.get(data.sourceId)
        if (!sourceFile) return

        const groupId = crypto.randomUUID()
        const newPages: PageReference[] = []

        for (let i = 0; i < sourceFile.pageCount; i++) {
          newPages.push({
            id: crypto.randomUUID(),
            sourceFileId: sourceFile.id,
            sourcePageIndex: i,
            rotation: 0,
            groupId,
          })
        }
        // execute AddPagesCommand (Undoable)
        execute(new AddPagesCommand(sourceFile, newPages, false))
        return
      }
    } catch {
      /* ignore invalid json */
    }
  }

  // 2. Check for External Files (OS Drop)
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
    <!-- Drop Overlay -->
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

    <!-- Grid -->
    <VueDraggable
      v-model="localPages"
      :animation="200"
      ghost-class="sortable-ghost"
      drag-class="sortable-drag"
      chosen-class="sortable-chosen"
      class="grid gap-4 min-h-[50vh] pb-20"
      :class="{
        'razor-mode': store.currentTool === 'razor',
        'pointer-events-none': draggingEnded,
      }"
      :style="gridStyle"
      @start="handleDragStart"
      @end="handleDragEnd"
    >
      <template v-for="(pageRef, index) in localPages" :key="pageRef.id">
        <!-- Divider (Virtual Page) -->
        <div
          v-if="pageRef.isDivider"
          class="col-span-full h-8 flex items-center gap-4 py-2 my-2 group/divider select-none"
        >
          <div
            class="h-px flex-1 bg-border group-hover/divider:bg-danger/40 transition-colors"
          ></div>
          <div
            class="flex items-center gap-2 text-xs font-mono font-bold text-text-muted/50 uppercase tracking-widest group-hover/divider:text-danger/70 transition-colors"
          >
            <Scissors class="w-3 h-3" />
            <span>New Document Section</span>
          </div>
          <div
            class="h-px flex-1 bg-border group-hover/divider:bg-danger/40 transition-colors"
          ></div>
        </div>

        <!-- PDF Thumbnail -->
        <PdfThumbnail
          v-else
          :page-ref="pageRef"
          :page-number="index + 1"
          :selected="isSelected(pageRef.id)"
          :width="store.zoom"
          :is-start-of-file="
            index === 0 ||
            (!localPages[index - 1]?.isDivider &&
              pageRef.groupId !== localPages[index - 1]?.groupId)
          "
          :is-razor-active="store.currentTool === 'razor'"
          :can-split="index > 0 && !localPages[index - 1]?.isDivider"
          @click="handlePageClick(pageRef, $event)"
          @preview="handlePreview(pageRef)"
          @contextmenu="handlePageContextMenu(pageRef, index, $event)"
          @delete="handleDelete(pageRef)"
          @rotate="handleRotate(pageRef)"
        />
      </template>
    </VueDraggable>

    <!-- Empty State / Hint -->
    <p v-if="localPages.length > 0" class="text-center text-sm text-text-muted mt-6">
      Drag to reorder • Double-click to preview • Right-click for more options
    </p>

    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :selected-count="store.selectedCount"
      :page-number="contextMenu.pageNumber"
      @close="contextMenu.visible = false"
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

.razor-mode {
  cursor:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cline x1='20' y1='4' x2='8.12' y2='15.88'/%3E%3Cline x1='14.47' y1='14.48' x2='20' y2='20'/%3E%3Cline x1='8.12' y1='8.12' x2='12' y2='12'/%3E%3C/svg%3E")
      12 12,
    crosshair;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sortable-ghost {
  opacity: 0.3;
  transform: scale(0.95);
  filter: grayscale(1);
}
.sortable-drag {
  opacity: 1 !important;
  transform: scale(1.05) !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  z-index: 50;
  cursor: grabbing !important;
}
</style>
