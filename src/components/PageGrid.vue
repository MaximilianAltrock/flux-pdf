<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { useGridLogic, type GridItem } from '@/composables/useGridLogic'
import SortableGridItem from './page-grid/SortableGridItem.vue'
import PageDivider from './page-grid/PageDivider.vue'
import PageGridItem from './page-grid/PageGridItem.vue'
import PageGridOverlay from './page-grid/PageGridOverlay.vue'
import { UserAction } from '@/types/actions'
import type { PageReference } from '@/types'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

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

const { localPages, isDragging, isSelected, gridItems } = useGridLogic(props.state.document)

const activeDragIds = ref<string[]>([])

// === File Drag Logic (with Counter to prevent flickering) ===
const isFileDragOver = ref(false)
const dragCounter = ref(0)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${props.state.zoom.value + 20}px, 1fr))`,
}))

const selectedCount = computed(() => props.state.document.selectedCount)

function getOrderedSelectedPageIds(): string[] {
  if (selectedCount.value === 0) return []
  const ordered: string[] = []
  for (const entry of localPages.value) {
    if (props.state.document.selectedIds.has(entry.id)) {
      ordered.push(entry.id)
    }
  }
  return ordered
}

function getDragLabel(item: GridItem): string {
  if (item.kind === 'page' && isSelected(item.id) && selectedCount.value > 1) {
    const count = selectedCount.value
    return `${count} page${count === 1 ? '' : 's'}`
  }
  return item.dragLabel
}

function resetPageDragState() {
  activeDragIds.value = []
}

function handleBackgroundClick(event: MouseEvent) {
  if (isDragging.value) return
  if (props.state.document.selectedCount === 0) return
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('[data-grid-item="page"]')) return
  props.actions.clearSelection()
}

// === Pdnd Logic (internal reordering) ===
let cleanup: (() => void) | null = null

onMounted(() => {
  cleanup = monitorForElements({
    onDragStart: ({ source }) => {
      isDragging.value = true
      const data = source.data as {
        type?: string
        id?: string
        entryType?: 'page' | 'divider'
      }
      if (data.type !== 'grid-item' || !data.id) {
        activeDragIds.value = []
        return
      }

      if (data.entryType === 'divider') {
        activeDragIds.value = [data.id]
        return
      }

      if (props.state.document.selectedIds.has(data.id) && selectedCount.value > 1) {
        activeDragIds.value = getOrderedSelectedPageIds()
      } else {
        activeDragIds.value = [data.id]
      }
    },
    onDrop: ({ source, location }) => {
      if (source.data.type !== 'grid-item') return

      isDragging.value = false
      const target = location.current.dropTargets[0]
      if (!target) {
        resetPageDragState()
        return
      }

      const data = source.data as {
        id?: string
        entryType?: 'page' | 'divider'
      }
      const sourceId = data.id
      if (!sourceId) {
        resetPageDragState()
        return
      }

      let draggedIds: string[] = []
      if (data.entryType === 'divider') {
        draggedIds = [sourceId]
      } else if (activeDragIds.value.length > 0 && activeDragIds.value.includes(sourceId)) {
        draggedIds = activeDragIds.value
      } else if (props.state.document.selectedIds.has(sourceId) && selectedCount.value > 1) {
        draggedIds = getOrderedSelectedPageIds()
      } else {
        draggedIds = [sourceId]
      }

      if (draggedIds.length === 0) {
        resetPageDragState()
        return
      }

      const targetIndex = target.data.index as number
      const targetId = target.data.id as string | undefined

      if (targetId && draggedIds.includes(targetId)) {
        resetPageDragState()
        return
      }

      const closestEdge = extractClosestEdge(target.data)

      // Calculate new order (supports multi-selection)
      const previousOrder = [...localPages.value]
      const draggedIdSet = new Set(draggedIds)
      const draggedItems: typeof previousOrder = []
      const remaining: typeof previousOrder = []

      for (const entry of previousOrder) {
        if (draggedIdSet.has(entry.id)) {
          draggedItems.push(entry)
        } else {
          remaining.push(entry)
        }
      }

      if (draggedItems.length === 0 || draggedItems.length === previousOrder.length) {
        resetPageDragState()
        return
      }

      let destinationIndex = targetIndex
      let removedBeforeTarget = 0
      for (let i = 0; i < targetIndex; i++) {
        const entry = previousOrder[i]
        if (entry && draggedIdSet.has(entry.id)) {
          removedBeforeTarget += 1
        }
      }
      destinationIndex -= removedBeforeTarget

      if (closestEdge === 'right') {
        destinationIndex += 1
      }

      if (destinationIndex < 0) destinationIndex = 0
      if (destinationIndex > remaining.length) destinationIndex = remaining.length

      const ordered = [
        ...remaining.slice(0, destinationIndex),
        ...draggedItems,
        ...remaining.slice(destinationIndex),
      ]

      props.actions.handleReorderPages(previousOrder, ordered)
      resetPageDragState()
    },
  })
})

onUnmounted(() => {
  cleanup?.()
})

// === File Drop Handlers ===
function handleFileDragEnter(event: DragEvent) {
  event.preventDefault()
  if (isDragging.value) return

  const types = event.dataTransfer?.types
  if (types?.includes('Files') || types?.includes('application/json')) {
    dragCounter.value++
    isFileDragOver.value = true
  }
}

function handleFileDragOver(event: DragEvent) {
  event.preventDefault()
}

function resetFileDragState() {
  dragCounter.value = 0
  isFileDragOver.value = false
}

function handleFileDragLeave(event: DragEvent) {
  event.preventDefault()
  if (isDragging.value) return

  dragCounter.value--
  if (dragCounter.value <= 0) {
    dragCounter.value = 0
    isFileDragOver.value = false
  }
}

async function handleFileDrop(event: DragEvent) {
  event.preventDefault()
  resetFileDragState()
  if (isDragging.value) return

  const jsonData = event.dataTransfer?.getData('application/json')
  if (jsonData) {
    try {
      const data = JSON.parse(jsonData)
      if (data.type === 'source-file' && data.sourceId) {
        emit('sourceDropped', data.sourceId)
        return
      }
    } catch {
      /* ignore */
    }
  }

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    emit('filesDropped', files)
  }
}

// === Grid Actions Relay ===
function handlePreview(pageRef: PageReference) {
  emit('preview', pageRef)
}

function handleContextAction(action: UserAction, pageRef: PageReference) {
  emit('contextAction', action, pageRef)
}

useEventListener('dragend', resetFileDragState)
useEventListener('drop', resetFileDragState)
useEventListener('dragend', resetPageDragState)
useEventListener('drop', resetPageDragState)
useEventListener('dragleave', (event) => {
  if (event.relatedTarget === null) {
    resetFileDragState()
  }
})
</script>

<template>
  <div
    class="h-full overflow-auto p-6 relative bg-background bg-grid-pattern"
    @dragenter="handleFileDragEnter"
    @dragover="handleFileDragOver"
    @dragleave="handleFileDragLeave"
    @drop="handleFileDrop"
    @click="handleBackgroundClick"
  >
    <!-- Drop Overlay (Glassmorphism + Icon) -->
    <PageGridOverlay :visible="isFileDragOver" />

    <!-- Grid Layout -->
    <div
      class="grid gap-4 min-h-[50vh] pb-20"
      :class="{ 'razor-mode': state.currentTool.value === 'razor' }"
      :style="gridStyle"
    >
      <SortableGridItem
        v-for="item in gridItems"
        :key="item.id"
        :entry="item.entry"
        :index="item.index"
        :drag-label="getDragLabel(item)"
        :is-divider="item.kind === 'divider'"
        :data-grid-item="item.kind"
        :class="{ 'col-span-full': item.kind === 'divider' }"
      >
        <PageDivider v-if="item.kind === 'divider'" />

        <PageGridItem
          v-else
          :page="item.entry"
          :index="item.index"
          :page-number="item.pageNumber"
          :selected="isSelected(item.id)"
          :is-start-of-file="item.isStartOfFile"
          :state="state"
          :actions="actions"
          @preview="handlePreview"
          @context-action="handleContextAction"
        />
      </SortableGridItem>
    </div>

    <p
      v-if="localPages.length > 0"
      class="text-center ui-caption ui-mono mt-6 opacity-60 uppercase tracking-[0.2em]"
    >
      Drag to reorder / Double-click to preview / Right-click for options
    </p>
  </div>
</template>

<style scoped>
.bg-grid-pattern {
  background-image:
    linear-gradient(
      to right,
      color-mix(in oklch, var(--primary), transparent 90%) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in oklch, var(--primary), transparent 90%) 1px,
      transparent 1px
    );
  background-size: 24px 24px;
}

.razor-mode {
  cursor:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cline x1='20' y1='4' x2='8.12' y2='15.88'/%3E%3Cline x1='14.47' y1='14.48' x2='20' y2='20'/%3E%3Cline x1='8.12' y1='8.12' x2='12' y2='12'/%3E%3C/svg%3E")
      12 12,
    crosshair;
}
</style>
