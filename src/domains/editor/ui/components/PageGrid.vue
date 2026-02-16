<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { useGridLogic, type GridItem } from '@/domains/editor/ui/useGridLogic'
import { useGridInteractionPolicy } from '@/domains/editor/ui/useGridInteractionPolicy'
import { usePageProblemMeta } from '@/domains/editor/ui/usePageProblemMeta'
import { usePageGridFileDrop } from '@/domains/editor/ui/usePageGridFileDrop'
import SortableGridItem from './grid/SortableGridItem.vue'
import PageDivider from './grid/PageDivider.vue'
import PageGridItem from './grid/PageGridItem.vue'
import PageGridOverlay from './grid/PageGridOverlay.vue'
import GridTargetingBanner from './grid/GridTargetingBanner.vue'
import { UserAction } from '@/shared/types/actions'
import type { PageReference } from '@/shared/types'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { usePreflight } from '@/domains/editor/application/usePreflight'
import { useUiStore } from '@/domains/editor/store/ui.store'

const emit = defineEmits<{
  filesDropped: [files: FileList]
  sourceDropped: [sourceId: string]
  sourcePageDropped: [sourceId: string, pageIndex: number]
  sourcePagesDropped: [pages: { sourceId: string; pageIndex: number }[]]
  preview: [pageRef: PageReference]
  contextAction: [action: UserAction, pageRef: PageReference]
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()
const ui = useUiStore()
const preflight = usePreflight()
const { policy } = useGridInteractionPolicy()

const { localPages, isDragging, isSelected, gridItems } = useGridLogic(document)

const activeDragIds = ref<string[]>([])

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${ui.zoom + 20}px, 1fr))`,
}))

const selectedCount = computed(() => document.selectedCount)
const isTargeting = computed(() => policy.value.tool === 'target')
const isRazor = computed(() => policy.value.tool === 'razor')

const { getPageProblemMeta } = usePageProblemMeta(preflight.problemsByPageId)
const {
  isFileDragOver,
  handleFileDragEnter,
  handleFileDragOver,
  handleFileDragLeave,
  handleFileDrop,
  resetFileDragState,
} = usePageGridFileDrop({
  allowDropFiles: computed(() => policy.value.allowDropFiles),
  isDragging,
  onFilesDropped: (files) => emit('filesDropped', files),
  onSourceDropped: (sourceId) => emit('sourceDropped', sourceId),
  onSourcePageDropped: (sourceId, pageIndex) => emit('sourcePageDropped', sourceId, pageIndex),
  onSourcePagesDropped: (pages) => emit('sourcePagesDropped', pages),
})

function getOrderedSelectedPageIds(): string[] {
  if (selectedCount.value === 0) return []
  const ordered: string[] = []
  for (const entry of localPages.value) {
    if (document.selectedIds.has(entry.id)) {
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
  if (!policy.value.allowSelection) return
  if (document.selectedCount === 0) return
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('[data-grid-item="page"]')) return
  actions.clearSelection()
}

// === Pdnd Logic (internal reordering) ===
let cleanup: (() => void) | null = null

onMounted(() => {
  cleanup = monitorForElements({
    onDragStart: ({ source }) => {
      if (!policy.value.allowDrag) {
        isDragging.value = false
        activeDragIds.value = []
        return
      }
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

      if (document.selectedIds.has(data.id) && selectedCount.value > 1) {
        activeDragIds.value = getOrderedSelectedPageIds()
      } else {
        activeDragIds.value = [data.id]
      }
    },
    onDrop: ({ source, location }) => {
      if (!policy.value.allowDrag) {
        isDragging.value = false
        resetPageDragState()
        return
      }
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
      } else if (document.selectedIds.has(sourceId) && selectedCount.value > 1) {
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

      actions.handleReorderPages(previousOrder, ordered)
      resetPageDragState()
    },
  })
})

onUnmounted(() => {
  cleanup?.()
})

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
useEventListener('keydown', (event) => {
  if (!isTargeting.value) return
  if (event.key !== 'Escape') return
  ui.endOutlineTargeting()
})
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

    <GridTargetingBanner :visible="isTargeting" @cancel="ui.endOutlineTargeting" />

    <!-- Grid Layout -->
    <div
      class="grid gap-4 min-h-[50vh] pb-20"
      :class="{
        'razor-mode': isRazor && !isTargeting,
        'outline-targeting': isTargeting,
      }"
      :style="gridStyle"
    >
      <SortableGridItem
        v-for="item in gridItems"
        :key="item.id"
        :entry="item.entry"
        :index="item.index"
        :drag-label="getDragLabel(item)"
        :is-divider="item.kind === 'divider'"
        :drag-disabled="!policy.allowDrag"
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
          :interaction-policy="policy"
          :problem-severity="getPageProblemMeta(item.id).severity"
          :problem-messages="getPageProblemMeta(item.id).messages"
          @preview="handlePreview"
          @context-action="handleContextAction"
        />
      </SortableGridItem>
    </div>

    <p
      v-if="localPages.length > 0"
      class="text-center ui-caption ui-mono mt-6 opacity-60 uppercase tracking-[0.2em]"
    >
      <span v-if="isTargeting">
        Outline targeting active — click a page to set target / Esc to cancel
      </span>
      <span v-else>
        Drag to reorder / Double-click to preview / Right-click for options
      </span>
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

.outline-targeting {
  cursor: crosshair;
}

.outline-targeting [data-grid-item='page'] {
  cursor: crosshair;
}
</style>


