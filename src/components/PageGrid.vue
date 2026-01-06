<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Scissors } from 'lucide-vue-next'
  import { VueDraggable } from 'vue-draggable-plus'
  import { useCommandManager } from '@/composables/useCommandManager'
  import { useGridLogic } from '@/composables/useGridLogic'
  import {
    ReorderPagesCommand,
    SplitGroupCommand,
  } from '@/commands'
  import PdfThumbnail from './PdfThumbnail.vue'
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
  } from '@/components/ui/context-menu'
  import {
    RotateCw,
    RotateCcw,
    Trash2,
    Copy,
    Eye,
    CheckSquare,
    Download
  } from 'lucide-vue-next'
  import type { PageReference } from '@/types'
  import { UserAction } from '@/types/actions'

// FIX: defineEmits cannot use computed keys ([UserAction.PREVIEW])
// We must use the string literal 'preview' here.
const emit = defineEmits<{
  filesDropped: [files: FileList]
  sourceDropped: [sourceId: string]
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
  emit('preview', pageRef)
}

function handleDelete(pageRef: PageReference) {
  emit('contextAction', UserAction.DELETE, pageRef)
}

function handleRotate(pageRef: PageReference) {
  emit('contextAction', UserAction.ROTATE_RIGHT, pageRef)
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
          emit('sourceDropped', data.sourceId)
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

        <!-- PDF Thumbnail with Context Menu -->
        <ContextMenu v-else>
          <ContextMenuTrigger>
            <PdfThumbnail
              :page-ref="pageRef"
              :page-number="index + 1"
              :selected="isSelected(pageRef.id)"
              :fixed-size="true"
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
              @delete="handleDelete(pageRef)"
              @rotate="handleRotate(pageRef)"
            />
          </ContextMenuTrigger>

          <ContextMenuContent>
            <!-- Header/Label -->
            <ContextMenuLabel class="text-xs text-text-muted font-medium border-b border-border px-3 py-2">
              {{ store.selectedCount > 1 ? `${store.selectedCount} pages selected` : `Page ${index + 1}` }}
            </ContextMenuLabel>

            <ContextMenuItem @select="handlePreview(pageRef)">
              <Eye class="w-4 h-4 mr-2 text-text-muted" />
              <span>Preview</span>
              <ContextMenuShortcut>Space</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem @select="emit('contextAction', UserAction.DUPLICATE, pageRef)">
              <Copy class="w-4 h-4 mr-2 text-text-muted" />
              <span>Duplicate</span>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem @select="emit('contextAction', UserAction.ROTATE_LEFT, pageRef)">
              <RotateCcw class="w-4 h-4 mr-2 text-text-muted" />
              <span>Rotate Left</span>
              <ContextMenuShortcut>⇧R</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem @select="emit('contextAction', UserAction.ROTATE_RIGHT, pageRef)">
              <RotateCw class="w-4 h-4 mr-2 text-text-muted" />
              <span>Rotate Right</span>
              <ContextMenuShortcut>R</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <template v-if="store.selectedCount > 0">
              <ContextMenuItem @select="emit('contextAction', UserAction.SELECT_ALL, pageRef)">
                <CheckSquare class="w-4 h-4 mr-2 text-text-muted" />
                <span>Select All</span>
                <ContextMenuShortcut>⌘A</ContextMenuShortcut>
              </ContextMenuItem>

              <ContextMenuItem @select="emit('contextAction', UserAction.EXPORT_SELECTED, pageRef)">
                <Download class="w-4 h-4 mr-2 text-text-muted" />
                <span>Export Selected</span>
              </ContextMenuItem>

              <ContextMenuSeparator />
            </template>

            <ContextMenuItem
               class="text-danger focus:text-danger focus:bg-danger/10"
               @select="handleDelete(pageRef)"
            >
              <Trash2 class="w-4 h-4 mr-2" />
              <span>Delete</span>
              <ContextMenuShortcut class="text-danger/50">Del</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>
    </VueDraggable>

    <p v-if="localPages.length > 0" class="text-center text-sm text-text-muted mt-6">
      Drag to reorder • Double-click to preview • Right-click for more options
    </p>
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
