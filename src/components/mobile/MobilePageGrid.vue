<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { ArrowDown } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { useGridLogic } from '@/composables/useGridLogic'
import PdfThumbnail from '@/components/PdfThumbnail.vue'
import PageDivider from '@/components/page-grid/PageDivider.vue'
import type { PageEntry, PageReference } from '@/types'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  selectionMode: boolean
  state: FacadeState
  actions: AppActions
}>()

// FIX: defineEmits cannot use computed keys. Use string literal.
const emit = defineEmits<{
  preview: [pageRef: PageReference]
}>()

const { haptic } = useMobile()
const { localPages, isDragging, isSelected, contentPages, getContentPageNumber } = useGridLogic(
  props.state.document,
)

// Local state for drag tracking
const dragStartOrder = ref<PageEntry[]>([])

// Mobile-specific state
const columnCount = ref(2)
const MIN_COLUMNS = 2
const MAX_COLUMNS = 4

// Long press for selection
const LONG_PRESS_MS = 400
const longPressPageId = ref<string | null>(null)
const { start: startLongPress, stop: stopLongPress } = useTimeoutFn(
  () => {
    const pageId = longPressPageId.value
    if (!pageId) return
    haptic('medium')
    props.actions.enterMobileSelectionMode()
    props.actions.selectPage(pageId, false)
    longPressPageId.value = null
  },
  LONG_PRESS_MS,
  { immediate: false },
)

// Jump mode
const jumpModeActive = ref(false)

// Pinch zoom tracking
const pinchStartDist = ref(0)
const isPinching = ref(false)

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

// === Touch Handlers ===

function handleTouchStart(pageRef: PageReference) {
  if (isDragging.value || pageRef.isDivider) return

  // Only start long press in normal mode
  if (!props.selectionMode) {
    longPressPageId.value = pageRef.id
    startLongPress()
  }
}

function handleTouchMove() {
  stopLongPress()
  longPressPageId.value = null
}

function handleTouchEnd() {
  stopLongPress()
  longPressPageId.value = null
}

function handlePageTap(pageRef: PageReference, event: Event) {
  if (isDragging.value || pageRef.isDivider) return
  event.preventDefault()

  if (props.selectionMode) {
    // Toggle selection
    haptic('light')
    props.actions.togglePageSelection(pageRef.id)

    // Exit selection mode if nothing selected
    if (props.state.document.selectedCount === 0) {
      jumpModeActive.value = false
      props.actions.exitMobileSelectionMode()
    }
  } else {
    // Open preview (Focus View)
    emit('preview', pageRef)
  }
}

// === Jump Feature ===

function activateJumpMode() {
  if (props.state.document.selectedCount === 0) return
  jumpModeActive.value = true
  haptic('light')
}

function handleJumpToPosition(targetIndex: number) {
  if (!jumpModeActive.value || props.state.document.selectedCount === 0) return

  haptic('medium')

  const previousOrder = [...localPages.value]
  const selectedIds = new Set(props.state.document.selectedIds)
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

  props.actions.handleReorderPages(previousOrder, newOrder)
  jumpModeActive.value = false
}

function cancelJumpMode() {
  jumpModeActive.value = false
}

// === Drag Handlers ===

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
    props.actions.handleReorderPages(dragStartOrder.value, [...localPages.value])
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

  if (event.cancelable) event.preventDefault()

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

function shouldShowJumpTarget(index: number): boolean {
  if (!jumpModeActive.value) return false

  const page = localPages.value[index]
  if (!page || page.isDivider) return false

  if (isSelected(page.id)) return false

  for (let i = index - 1; i >= 0; i--) {
    const prev = localPages.value[i]
    if (!prev || prev.isDivider) continue
    return !isSelected(prev.id)
  }

  return true
}

function preventContextMenu(e: Event) {
  e.preventDefault()
}

// === Lifecycle ===

onMounted(() => {
  useEventListener(document, 'touchstart', handlePinchStart, { passive: false })
  useEventListener(document, 'touchmove', handlePinchMove, { passive: false })
  useEventListener(document, 'touchend', handlePinchEnd)
})

</script>

<template>
  <div
    class="h-full overflow-y-auto overflow-x-hidden bg-background grid-touch-area no-scrollbar"
    @contextmenu="preventContextMenu"
  >
    <Transition name="slide-down">
      <div
        v-if="jumpModeActive"
        class="sticky top-0 z-20 bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground shadow-sm"
      >
        <span class="text-sm font-semibold">
          Tap where to move {{ props.state.document.selectedCount }} page{{
            props.state.document.selectedCount > 1 ? 's' : ''
          }}
        </span>
        <button class="text-xs font-semibold opacity-80 active:opacity-100" @click="cancelJumpMode">
          Cancel
        </button>
      </div>
    </Transition>

    <VueDraggable
      v-model="localPages"
      :animation="200"
      :delay="props.selectionMode ? 150 : 0"
      :delay-on-touch-only="true"
      :touch-start-threshold="10"
      :disabled="!props.selectionMode || jumpModeActive"
      ghost-class="ide-sortable-ghost"
      drag-class="ide-sortable-drag"
      chosen-class="mobile-chosen"
      class="grid gap-3 p-4 min-h-[50vh]"
      :style="gridStyle"
      @start="handleDragStart"
      @end="handleDragEnd"
    >
      <template v-for="(pageRef, index) in localPages" :key="pageRef.id">
        <button
          v-if="shouldShowJumpTarget(index)"
          class="col-span-full h-12 -my-1 border border-dashed border-primary/60 rounded-md flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/15 transition-colors"
          @click="handleJumpToPosition(index)"
        >
          <ArrowDown class="w-4 h-4" />
          <span>Move here</span>
        </button>

        <!-- High-Fidelity Section Divider (Mobile) -->
        <PageDivider v-if="pageRef.isDivider" variant="mobile" />

        <div
          v-else
          class="relative"
          :class="{ 'opacity-40': jumpModeActive && isSelected(pageRef.id) }"
          @touchstart="handleTouchStart(pageRef)"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @click="handlePageTap(pageRef, $event)"
        >
          <Transition name="pop">
            <div
              v-if="props.selectionMode && isSelected(pageRef.id)"
              class="absolute -top-1 -right-1 z-10 w-6 h-6 bg-primary rounded-sm flex items-center justify-center shadow-sm"
            >
              <svg
                class="w-4 h-4 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="3"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </Transition>

          <Transition name="fade">
            <div
              v-if="longPressPageId === pageRef.id"
              class="absolute inset-0 bg-primary/20 rounded-md z-10 pointer-events-none"
            />
          </Transition>

          <PdfThumbnail
            :page-ref="pageRef"
            :page-number="getContentPageNumber(pageRef.id)"
            :selected="props.selectionMode && isSelected(pageRef.id)"
            :fixed-size="false"
            :width="300"
            :source-color="props.state.document.getSourceColor(pageRef.sourceFileId)"
            :is-start-of-file="false"
            :is-razor-active="false"
            :can-split="false"
            class="pointer-events-none"
          />
        </div>
      </template>

      <button
        v-if="jumpModeActive"
        class="col-span-full h-12 border border-dashed border-primary/60 rounded-md flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/15 transition-colors"
        @click="handleJumpToPosition(localPages.length)"
      >
        <ArrowDown class="w-4 h-4" />
        <span>Move to end</span>
      </button>
    </VueDraggable>

    <Transition name="fade">
      <div
        v-if="
          props.selectionMode &&
          props.state.document.selectedCount > 0 &&
          !jumpModeActive &&
          !isDragging
        "
        class="sticky bottom-4 flex justify-center pointer-events-none"
      >
        <button
          class="pointer-events-auto px-4 py-2 ui-panel rounded-md text-sm font-medium text-foreground active:scale-95 transition-transform"
          @click="activateJumpMode"
        >
          Tap to move selection
        </button>
      </div>
    </Transition>

    <p
      v-if="contentPages.length > 0 && !jumpModeActive"
      class="text-center ui-caption py-4 px-6"
    >
      {{
        props.selectionMode
          ? 'Drag to reorder / Tap to select'
          : 'Long-press to select / Tap to preview'
      }}
    </p>

    <div
      v-if="contentPages.length === 0"
      class="absolute inset-0 flex items-center justify-center p-8"
    >
      <div class="text-center text-muted-foreground">
        <p class="text-sm font-semibold mb-2">No pages yet</p>
        <p class="ui-caption">Tap + to add a PDF</p>
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

.grid-touch-area {
  touch-action: pan-y;
  overscroll-behavior: contain;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
