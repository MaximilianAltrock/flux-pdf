<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { useGridLogic } from '@/composables/useGridLogic'
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

// === File Drag Logic (with Counter to prevent flickering) ===
const isFileDragOver = ref(false)
const dragCounter = ref(0)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${props.state.zoom.value + 20}px, 1fr))`,
}))

// === Pdnd Logic (internal reordering) ===
let cleanup: (() => void) | null = null

onMounted(() => {
  cleanup = monitorForElements({
    onDragStart: () => {
      isDragging.value = true
    },
    onDrop: ({ source, location }) => {
      if (source.data.type !== 'grid-item') return

      isDragging.value = false
      const target = location.current.dropTargets[0]
      if (!target) return

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
        destinationIndex -= 1
      }

      if (closestEdge === 'right') {
        destinationIndex += 1
      }

      ordered.splice(destinationIndex, 0, item)
      props.actions.handleReorderPages([...localPages.value], ordered)
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
        :drag-label="item.dragLabel"
        :is-divider="item.kind === 'divider'"
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
