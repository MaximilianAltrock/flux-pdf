<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Scissors, ArrowDown } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { useMobile } from '@/composables/useMobile'
import { ReorderPagesCommand } from '@/commands'
import PdfThumbnail from './PdfThumbnail.vue'
import type { PageReference } from '@/types'

const props = defineProps<{
  selectionMode: boolean
}>()

const emit = defineEmits<{
  enterSelection: []
  exitSelection: []
  preview: [pageRef: PageReference]
}>()

const store = useDocumentStore()
const { execute } = useCommandManager()
const { haptic, screenWidth } = useMobile()

// Local copy for drag operations (same pattern as PageGrid.vue)
const localPages = ref<PageReference[]>([])
const isDragging = ref(false)
const dragStartOrder = ref<PageReference[]>([])

// Mobile-specific state
const columnCount = ref(3)
const MIN_COLUMNS = 2
const MAX_COLUMNS = 4

// Long press for selection
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const longPressPageId = ref<string | null>(null)
const LONG_PRESS_MS = 400

// Jump mode - for moving pages long distances
const jumpModeActive = ref(false)

// Pinch zoom tracking
const pinchStartDist = ref(0)
const isPinching = ref(false)

// Sync local pages with store (same pattern as PageGrid.vue)
watch(
  () => store.pages,
  (newPages) => {
    if (!isDragging.value) {
      localPages.value = [...newPages]
    }
  },
  { deep: true, immediate: true },
)

// Exit jump mode when exiting selection mode
watch(
  () => props.selectionMode,
  (active) => {
    if (!active) {
      jumpModeActive.value = false
    }
  },
)

// Dynamic grid style
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columnCount.value}, 1fr)`,
}))

// Calculate thumbnail width
const thumbnailWidth = computed(() => {
  const padding = 32 // p-4 = 16px each side
  const gap = 12 * (columnCount.value - 1) // gap-3 = 12px
  const available = screenWidth.value - padding - gap
  return Math.floor(available / columnCount.value)
})

// Visible pages (non-deleted, non-divider) for page numbering
const visiblePages = computed(() => localPages.value.filter((p) => !p.deleted && !p.isDivider))

// === Touch Handlers ===

function handleTouchStart(pageRef: PageReference) {
  if (isDragging.value || pageRef.deleted || pageRef.isDivider) return

  // Only start long press in normal mode
  if (!props.selectionMode) {
    longPressPageId.value = pageRef.id
    longPressTimer.value = setTimeout(() => {
      haptic('medium')
      emit('enterSelection')
      store.selectPage(pageRef.id, false)
      longPressPageId.value = null
    }, LONG_PRESS_MS)
  }
}

function handleTouchMove() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
    longPressPageId.value = null
  }
}

function handleTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  longPressPageId.value = null
}

function handlePageTap(pageRef: PageReference, event: Event) {
  if (isDragging.value || pageRef.deleted || pageRef.isDivider) return
  event.preventDefault()

  if (props.selectionMode) {
    // Toggle selection
    haptic('light')
    store.togglePageSelection(pageRef.id)

    // Exit selection mode if nothing selected
    if (store.selectedCount === 0) {
      jumpModeActive.value = false
      emit('exitSelection')
    }
  } else {
    // Open preview (Focus View)
    emit('preview', pageRef)
  }
}

// === Jump Feature ===

function activateJumpMode() {
  if (store.selectedCount === 0) return
  jumpModeActive.value = true
  haptic('light')
}

function handleJumpToPosition(targetIndex: number) {
  if (!jumpModeActive.value || store.selectedCount === 0) return

  haptic('medium')

  const selectedIds = new Set(store.selection.selectedIds)
  const selectedPages = localPages.value.filter((p) => selectedIds.has(p.id))
  const otherPages = localPages.value.filter((p) => !selectedIds.has(p.id))

  // Calculate adjusted index (account for removed selected items)
  let adjustedIndex = targetIndex
  for (let i = 0; i < targetIndex && i < localPages.value.length; i++) {
    const page = localPages.value[i]
    if (page && selectedIds.has(page.id)) {
      adjustedIndex--
    }
  }

  // Build new order
  const newOrder = [
    ...otherPages.slice(0, adjustedIndex),
    ...selectedPages,
    ...otherPages.slice(adjustedIndex),
  ]

  execute(new ReorderPagesCommand([...localPages.value], newOrder))
  jumpModeActive.value = false
}

function cancelJumpMode() {
  jumpModeActive.value = false
}

// === Drag Handlers (same pattern as PageGrid.vue) ===

function handleDragStart() {
  isDragging.value = true
  dragStartOrder.value = [...localPages.value]
  haptic('medium')
}

function handleDragEnd() {
  isDragging.value = false

  const orderChanged = localPages.value.some(
    (page, index) => page.id !== dragStartOrder.value[index]?.id,
  )

  if (orderChanged) {
    execute(new ReorderPagesCommand(dragStartOrder.value, [...localPages.value]))
    haptic('light')
  }

  dragStartOrder.value = []
}

// === Pinch Zoom ===

function handlePinchStart(event: TouchEvent) {
  if (event.touches.length !== 2) return

  isPinching.value = true
  const t1 = event.touches[0]!
  const t2 = event.touches[1]!
  pinchStartDist.value = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
}

function handlePinchMove(event: TouchEvent) {
  if (!isPinching.value || event.touches.length !== 2) return

  const t1 = event.touches[0]!
  const t2 = event.touches[1]!
  const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
  const delta = currentDist - pinchStartDist.value

  if (Math.abs(delta) > 80) {
    if (delta > 0 && columnCount.value > MIN_COLUMNS) {
      // Pinch out = fewer columns = larger thumbnails
      columnCount.value--
      haptic('light')
    } else if (delta < 0 && columnCount.value < MAX_COLUMNS) {
      // Pinch in = more columns = smaller thumbnails (bird's eye)
      columnCount.value++
      haptic('light')
    }
    pinchStartDist.value = currentDist
  }
}

function handlePinchEnd() {
  isPinching.value = false
}

// === Helpers ===

function isSelected(pageRef: PageReference): boolean {
  return store.selection.selectedIds.has(pageRef.id)
}

function getVisiblePageNumber(pageRef: PageReference): number {
  let count = 0
  for (const p of localPages.value) {
    if (p.deleted || p.isDivider) continue
    count++
    if (p.id === pageRef.id) return count
  }
  return count
}

// Check if we should show a jump target before this index
function shouldShowJumpTarget(index: number): boolean {
  if (!jumpModeActive.value) return false

  const page = localPages.value[index]
  if (!page || page.deleted || page.isDivider) return false

  // Don't show target if this page is selected
  if (isSelected(page)) return false

  // Don't show target if previous visible page is selected
  for (let i = index - 1; i >= 0; i--) {
    const prev = localPages.value[i]
    if (!prev || prev.deleted || prev.isDivider) continue
    // Found previous visible page
    return !isSelected(prev)
  }

  return true // First visible page
}

// === Lifecycle ===

onMounted(() => {
  document.addEventListener('touchstart', handlePinchStart, { passive: true })
  document.addEventListener('touchmove', handlePinchMove, { passive: true })
  document.addEventListener('touchend', handlePinchEnd)
})

onUnmounted(() => {
  document.removeEventListener('touchstart', handlePinchStart)
  document.removeEventListener('touchmove', handlePinchMove)
  document.removeEventListener('touchend', handlePinchEnd)

  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
  }
})
</script>

<template>
  <div class="h-full overflow-auto bg-background">
    <!-- Jump Mode Header -->
    <Transition name="slide-down">
      <div
        v-if="jumpModeActive"
        class="sticky top-0 z-20 bg-primary px-4 py-3 flex items-center justify-between text-white shadow-lg"
      >
        <span class="font-medium">
          Tap where to move {{ store.selectedCount }} page{{ store.selectedCount > 1 ? 's' : '' }}
        </span>
        <button class="text-sm font-medium opacity-80 active:opacity-100" @click="cancelJumpMode">
          Cancel
        </button>
      </div>
    </Transition>

    <!-- Draggable Grid -->
    <VueDraggable
      v-model="localPages"
      :animation="200"
      :delay="props.selectionMode ? 150 : 0"
      :delay-on-touch-only="true"
      :touch-start-threshold="10"
      :disabled="!props.selectionMode || jumpModeActive"
      ghost-class="mobile-ghost"
      drag-class="mobile-drag"
      chosen-class="mobile-chosen"
      class="grid gap-3 p-4 min-h-[50vh]"
      :style="gridStyle"
      @start="handleDragStart"
      @end="handleDragEnd"
    >
      <template v-for="(pageRef, index) in localPages" :key="pageRef.id">
        <!-- Jump Target (before page) -->
        <button
          v-if="shouldShowJumpTarget(index)"
          class="col-span-full h-14 -my-1 border-2 border-dashed border-primary/60 rounded-xl flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/15 transition-colors"
          @click="handleJumpToPosition(index)"
        >
          <ArrowDown class="w-4 h-4" />
          <span>Move here</span>
        </button>

        <!-- DIVIDER OBJECT -->
        <div v-if="pageRef.isDivider" class="col-span-full h-6 flex items-center gap-3 my-2">
          <div class="h-px flex-1 bg-border" />
          <div
            class="flex items-center gap-1.5 text-[10px] font-mono text-text-muted/50 uppercase tracking-wider"
          >
            <Scissors class="w-3 h-3" />
            <span>Split</span>
          </div>
          <div class="h-px flex-1 bg-border" />
        </div>

        <!-- Deleted page (hidden placeholder) -->
        <div v-else-if="pageRef.deleted" class="hidden" />

        <!-- Normal Page Thumbnail -->
        <div
          v-else
          class="relative"
          :class="{ 'opacity-40': jumpModeActive && isSelected(pageRef) }"
          @touchstart="handleTouchStart(pageRef)"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @click="handlePageTap(pageRef, $event)"
        >
          <!-- Selection checkmark -->
          <Transition name="pop">
            <div
              v-if="props.selectionMode && isSelected(pageRef)"
              class="absolute -top-1 -right-1 z-10 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg"
            >
              <svg
                class="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="3"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </Transition>

          <!-- Long press feedback -->
          <Transition name="fade">
            <div
              v-if="longPressPageId === pageRef.id"
              class="absolute inset-0 bg-primary/20 rounded-lg z-10 pointer-events-none"
            />
          </Transition>

          <PdfThumbnail
            :page-ref="pageRef"
            :page-number="getVisiblePageNumber(pageRef)"
            :selected="props.selectionMode && isSelected(pageRef)"
            :width="thumbnailWidth"
            :is-start-of-file="false"
            :is-razor-active="false"
            :can-split="false"
            class="pointer-events-none"
          />
        </div>
      </template>

      <!-- Final Jump Target -->
      <button
        v-if="jumpModeActive"
        class="col-span-full h-14 border-2 border-dashed border-primary/60 rounded-xl flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/15 transition-colors"
        @click="handleJumpToPosition(localPages.length)"
      >
        <ArrowDown class="w-4 h-4" />
        <span>Move to end</span>
      </button>
    </VueDraggable>

    <!-- Jump Mode Activation Button -->
    <Transition name="fade">
      <div
        v-if="props.selectionMode && store.selectedCount > 0 && !jumpModeActive && !isDragging"
        class="sticky bottom-4 flex justify-center pointer-events-none"
      >
        <button
          class="pointer-events-auto px-5 py-2.5 bg-surface border border-border rounded-full shadow-xl text-sm font-medium text-text active:scale-95 transition-transform"
          @click="activateJumpMode"
        >
          Tap to move selection
        </button>
      </div>
    </Transition>

    <!-- Help text -->
    <p
      v-if="visiblePages.length > 0 && !jumpModeActive"
      class="text-center text-xs text-text-muted py-4 px-6"
    >
      {{
        props.selectionMode
          ? 'Drag to reorder • Tap to select'
          : 'Long-press to select • Tap to preview'
      }}
    </p>

    <!-- Empty state -->
    <div
      v-if="visiblePages.length === 0"
      class="absolute inset-0 flex items-center justify-center p-8"
    >
      <div class="text-center text-text-muted">
        <p class="text-lg font-medium mb-2">No pages yet</p>
        <p class="text-sm">Tap + to add a PDF</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.pop-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pop-leave-active {
  transition: all 0.15s ease-in;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0);
}

.mobile-ghost {
  opacity: 0.4;
}

.mobile-drag {
  opacity: 1 !important;
  transform: scale(1.05);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.mobile-chosen {
  opacity: 0.8;
}
</style>
