<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { ArrowDown, Check } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { useGridLogic } from '@/composables/useGridLogic'
import PdfThumbnail from '@/components/PdfThumbnail.vue'
import PageDivider from '@/components/page-grid/PageDivider.vue'
import { type PageReference, type PageEntry, isDividerEntry } from '@/types'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  preview: [pageRef: PageReference]
}>()

const { haptic } = useMobile()
const { localPages, isSelected, contentPages, getContentPageNumber } = useGridLogic(
  props.state.document,
)

// Mode helpers
const mode = computed(() => props.state.mobileMode.value)
const isBrowse = computed(() => mode.value === 'browse')
const isSelect = computed(() => mode.value === 'select')
const isMove = computed(() => mode.value === 'move')

const selectedCount = computed(() => props.state.document.selectedCount)
const selectedIds = computed(() => props.state.document.selectedIds)

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

// Pinch zoom tracking
const pinchStartDist = ref(0)
const isPinching = ref(false)

// Dynamic grid style
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columnCount.value}, 1fr)`,
}))

// === Drop Targets for Move Mode ===
const dropTargets = computed(() => {
  if (!isMove.value) return new Set<number>()

  const targets = new Set<number>()
  const pages = localPages.value

  for (let i = 0; i <= pages.length; i++) {
    // Check if we can insert at this position
    // Skip positions that are between selected pages
    const prevPage = i > 0 ? pages[i - 1] : undefined
    const nextPage = i < pages.length ? pages[i] : undefined

    const prevSelected = prevPage && !isDividerEntry(prevPage) && selectedIds.value.has(prevPage.id)
    const nextSelected = nextPage && !isDividerEntry(nextPage) && selectedIds.value.has(nextPage.id)

    // Show drop target if not between selected pages
    if (!prevSelected && !nextSelected) {
      targets.add(i)
    }
    // Also show at the boundary of selected block
    if (prevSelected && !nextSelected) {
      targets.add(i)
    }
    if (!prevSelected && nextSelected) {
      targets.add(i)
    }
  }

  return targets
})

// === Touch Handlers ===

function handleTouchStart(page: PageEntry) {
  if (isDividerEntry(page)) return
  if (isMove.value) return // No long-press in move mode

  if (isBrowse.value) {
    longPressPageId.value = page.id
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

function handlePageTap(page: PageEntry, event: Event) {
  if (isDividerEntry(page)) return
  event.preventDefault()

  if (isMove.value) {
    // In move mode, taps on pages are ignored
    return
  }

  if (isSelect.value) {
    // Toggle selection
    haptic('light')
    props.actions.togglePageSelection(page.id)
  } else {
    // Browse mode: open preview
    emit('preview', page)
  }
}

function handleDropMarkerTap(index: number) {
  haptic('medium')
  props.actions.handleMoveSelectedToPosition(index)
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
      columnCount.value--
      haptic('light')
    } else if (delta < 0 && columnCount.value < MAX_COLUMNS) {
      columnCount.value++
      haptic('light')
    }
    pinchStartDist.value = currentDist
  }
}

function handlePinchEnd() {
  isPinching.value = false
}

function preventContextMenu(e: Event) {
  e.preventDefault()
}

// === Lifecycle ===
useEventListener(document, 'touchstart', handlePinchStart, { passive: false })
useEventListener(document, 'touchmove', handlePinchMove, { passive: false })
useEventListener(document, 'touchend', handlePinchEnd)
</script>

<template>
  <div
    class="h-full overflow-y-auto overflow-x-hidden grid-touch-area no-scrollbar"
    :class="isMove ? 'bg-muted/30' : 'bg-background'"
    @contextmenu="preventContextMenu"
  >
    <!-- Move mode header -->
    <Transition name="slide-down">
      <div
        v-if="isMove"
        class="sticky top-0 z-20 bg-destructive/90 px-4 py-3 flex items-center justify-center text-destructive-foreground"
      >
        <span class="text-sm font-medium">
          Tap where to move {{ selectedCount }} page{{ selectedCount > 1 ? 's' : '' }}
        </span>
      </div>
    </Transition>

    <!-- Page Grid -->
    <div class="grid gap-3 p-4 min-h-[50vh]" :style="gridStyle">
      <template v-for="(pageRef, index) in localPages" :key="pageRef.id">
        <!-- Drop marker before this page (in Move mode) -->
        <button
          v-if="isMove && dropTargets.has(index) && !selectedIds.has(pageRef.id)"
          class="col-span-full h-12 -my-1 border-2 border-dashed border-destructive/60 rounded-lg flex items-center justify-center gap-2 text-destructive text-sm font-medium bg-destructive/5 active:bg-destructive/15 transition-colors"
          @click="handleDropMarkerTap(index)"
        >
          <ArrowDown class="w-4 h-4" />
          <span>Insert here</span>
        </button>

        <!-- Section Divider -->
        <PageDivider v-if="pageRef.isDivider" variant="mobile" class="col-span-full" />

        <!-- Page Thumbnail -->
        <div
          v-else
          class="relative transition-opacity duration-200"
          :class="{
            'opacity-40': isMove && selectedIds.has(pageRef.id),
          }"
          @touchstart="handleTouchStart(pageRef)"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @click="handlePageTap(pageRef, $event)"
        >
          <!-- Selection badge -->
          <Transition name="pop">
            <div
              v-if="isSelect && isSelected(pageRef.id)"
              class="absolute -top-1 -right-1 z-10 w-6 h-6 bg-primary rounded-md flex items-center justify-center shadow-sm"
            >
              <Check class="w-4 h-4 text-primary-foreground" stroke-width="3" />
            </div>
          </Transition>

          <!-- Long press highlight -->
          <Transition name="fade">
            <div
              v-if="longPressPageId === pageRef.id"
              class="absolute inset-0 bg-primary/20 rounded-lg z-10 pointer-events-none"
            />
          </Transition>

          <PdfThumbnail
            :page-ref="pageRef"
            :page-number="getContentPageNumber(pageRef.id)"
            :selected="isSelect && isSelected(pageRef.id)"
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

      <!-- Drop marker at end (in Move mode) -->
      <button
        v-if="isMove && dropTargets.has(localPages.length)"
        class="col-span-full h-12 border-2 border-dashed border-destructive/60 rounded-lg flex items-center justify-center gap-2 text-destructive text-sm font-medium bg-destructive/5 active:bg-destructive/15 transition-colors"
        @click="handleDropMarkerTap(localPages.length)"
      >
        <ArrowDown class="w-4 h-4" />
        <span>Move to end</span>
      </button>
    </div>

    <!-- Helper text -->
    <p
      v-if="contentPages.length > 0 && !isMove"
      class="text-center text-muted-foreground text-xs py-4 px-6"
    >
      <template v-if="isSelect"> Tap pages to select </template>
      <template v-else> Long-press to select · Tap to preview </template>
    </p>

    <!-- Empty state -->
    <div
      v-if="contentPages.length === 0"
      class="absolute inset-0 flex items-center justify-center p-8"
    >
      <div class="text-center text-muted-foreground">
        <p class="text-sm font-semibold mb-2">No pages yet</p>
        <p class="text-xs">Tap + to add a PDF</p>
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
