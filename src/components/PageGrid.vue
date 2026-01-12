<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { useGridLogic } from '@/composables/useGridLogic'
import PdfThumbnail from './PdfThumbnail.vue'
import SortableGridItem from './SortableGridItem.vue'
import PageDivider from './PageDivider.vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuLabel,
} from '@/components/ui/context-menu'
import { RotateCw, RotateCcw, Trash2, Copy, Eye, CheckSquare, Download } from 'lucide-vue-next'
import type { PageEntry, PageReference } from '@/types'
import { UserAction } from '@/types/actions'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

// FIX: defineEmits cannot use computed keys ([UserAction.PREVIEW])
// We must use the string literal 'preview' here.
const emit = defineEmits<{
  filesDropped: [files: FileList]
  sourceDropped: [sourceId: string]
  preview: [pageRef: PageReference]
  contextAction: [action: UserAction, pageRef: PageReference]
}>()

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const { localPages, isDragging, isSelected, getContentPageNumber, store } = useGridLogic()

// Local state for drag logic
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
  gridTemplateColumns: `repeat(auto-fill, minmax(${props.state.zoom.value + 20}px, 1fr))`,
}))

function isStartOfFile(page: PageEntry, index: number): boolean {
  if (page.isDivider) return false
  if (index === 0) return true
  const prev = localPages.value[index - 1]
  if (!prev || prev.isDivider) return false
  return page.groupId !== prev.groupId
}

// === Pdnd Logic ===
let cleanup: (() => void) | null = null

onMounted(() => {
  cleanup = monitorForElements({
    onDragStart: () => {
      isDragging.value = true
      contextMenu.value.visible = false
    },
    onDrop: ({ source, location }) => {
      if (source.data.type !== 'grid-item') return

      isDragging.value = false
      const target = location.current.dropTargets[0]
      if (!target) {
        return
      }

      const sourceIndex = source.data.index as number
      const targetIndex = target.data.index as number

      if (sourceIndex === targetIndex) return

      const closestEdge = extractClosestEdge(target.data)

      // Calculate new order
      const ordered = [...localPages.value]
      const [item] = ordered.splice(sourceIndex, 1)
      if (!item) return

      let destinationIndex = targetIndex
      if (sourceIndex < targetIndex) {
        destinationIndex -= 1 // Adjust for removal
      }

      if (closestEdge === 'right') {
        destinationIndex += 1
      } else if (closestEdge === 'left') {
        // insert before, no change to destinationIndex
      }

      ordered.splice(destinationIndex, 0, item)

      props.actions.handleReorderPages([...localPages.value], ordered)
    },
  })
})

onUnmounted(() => {
  cleanup?.()
})

// === Event Handlers ===

function handlePageClick(pageRef: PageReference, event: MouseEvent) {
  contextMenu.value.visible = false

  if (props.state.currentTool.value === 'razor') {
    const index = store.pages.findIndex((p) => p.id === pageRef.id)
    const prevPage = store.pages[index - 1]

    // Prevent invalid splits
    if (index > 0 && index < store.pages.length - 1 && prevPage && !prevPage.isDivider) {
      props.actions.handleSplitGroup(index)
    }
    return
  }

  // Selection Logic
  if (event.metaKey || event.ctrlKey) {
    props.actions.togglePageSelection(pageRef.id)
  } else if (event.shiftKey && store.selection.lastSelectedId) {
    props.actions.selectRange(store.selection.lastSelectedId, pageRef.id)
  } else {
    const isOnlySelected = store.selection.selectedIds.has(pageRef.id) && store.selectedCount === 1
    if (isOnlySelected) {
      props.actions.clearSelection()
    } else {
      props.actions.selectPage(pageRef.id, false)
    }
  }
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
  // Always prevent default to allow drops (browser requires this)
  event.preventDefault()

  if (isDragging.value) {
    // If we are dragging pages, we don't want to show the file overlay
    // But we MUST preventDefault to allow the drop event to bubble/happen for PDND?
    // Actually PDND handles its own events, but the container backdrop needs this.
    return
  }

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

  // If internally dragging, ignore this native drop (let monitorForElements handle it via PDND)
  if (isDragging.value) return

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
    <div
      class="grid gap-4 min-h-[50vh] pb-20"
      :class="{
        'razor-mode': props.state.currentTool.value === 'razor',
      }"
      :style="gridStyle"
    >
      <SortableGridItem
        v-for="(pageRef, index) in localPages"
        :key="pageRef.id"
        :page="pageRef"
        :index="index"
        :class="{ 'col-span-full': pageRef.isDivider }"
      >
        <!-- High-Fidelity Section Divider -->
            <div
              v-if="pageRef.isDivider"
              class="h-full"
            >
              <PageDivider />
            </div>

        <!-- PDF Thumbnail with Context Menu -->
        <ContextMenu v-else>
          <ContextMenuTrigger>
            <PdfThumbnail
              :page-ref="pageRef"
              :page-number="getContentPageNumber(pageRef.id) || index + 1"
              :selected="isSelected(pageRef.id)"
              :fixed-size="true"
              :width="props.state.zoom.value"
              :source-color="props.state.document.getSourceColor(pageRef.sourceFileId)"
              :is-start-of-file="isStartOfFile(pageRef, index)"
              :is-razor-active="props.state.currentTool.value === 'razor'"
              :can-split="index > 0 && !localPages[index - 1]?.isDivider"
              @click="handlePageClick(pageRef, $event)"
              @preview="handlePreview(pageRef)"
              @delete="handleDelete(pageRef)"
              @rotate="handleRotate(pageRef)"
            />
          </ContextMenuTrigger>

          <ContextMenuContent>
            <!-- Header/Label -->
            <ContextMenuLabel
              class="text-xs text-text-muted font-medium border-b border-border px-3 py-2"
            >
              {{
                store.selectedCount > 1
                  ? `${store.selectedCount} pages selected`
                  : `Page ${getContentPageNumber(pageRef.id) || index + 1}`
              }}
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
                <ContextMenuShortcut>⌘A</ContextMenuShortcut>
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
      </SortableGridItem>
    </div>

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
</style>
