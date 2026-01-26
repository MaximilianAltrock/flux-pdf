<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { ArrowDown, Scissors } from 'lucide-vue-next'
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
const isSplit = computed(() => props.state.currentTool.value === 'razor')
const isBrowse = computed(() => mode.value === 'browse' && !isSplit.value)
const isSelect = computed(() => mode.value === 'select')
const isMove = computed(() => mode.value === 'move')

const selectedCount = computed(() => props.state.document.selectedCount)
const selectedIds = computed(() => props.state.document.selectedIds)
const problemsByPageId = computed(() => props.state.preflight.problemsByPageId.value)

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

// === Split Targets ===
const splitTargets = computed(() => {
  if (!isSplit.value) return new Set<number>()

  const targets = new Set<number>()
  const pages = localPages.value

  for (let i = 1; i < pages.length; i++) {
    const prev = pages[i - 1]
    const next = pages[i]
    if (!prev || !next) continue
    if (isDividerEntry(prev) || isDividerEntry(next)) continue
    targets.add(i)
  }

  return targets
})

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
  if (isMove.value || isSplit.value) return // No long-press in move/split mode

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

  if (isMove.value || isSplit.value) {
    // In move/split mode, taps on pages are ignored
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
  props.actions.handleMoveSelectedToPosition(index)
}

function handleSplitMarkerTap(index: number) {
  props.actions.handleSplitGroup(index)
}

function getProblemSeverity(pageId: string) {
  const problems = problemsByPageId.value.get(pageId) ?? []
  if (problems.some((p) => p.severity === 'error')) return 'error'
  if (problems.some((p) => p.severity === 'warning')) return 'warning'
  if (problems.some((p) => p.severity === 'info')) return 'info'
  return undefined
}

function getProblemMessages(pageId: string) {
  const problems = problemsByPageId.value.get(pageId) ?? []
  return problems.map((p) => p.message)
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
    :class="isMove || isSplit ? 'bg-muted/20' : 'bg-background'"
    @contextmenu="preventContextMenu"
  >
    <!-- Split mode header -->
    <Transition name="slide-down">
      <div
        v-if="isSplit"
        class="sticky top-0 z-20 bg-accent px-4 py-3 flex items-center justify-center text-accent-foreground border-b border-accent/50 shadow-sm"
      >
        <span class="text-sm font-medium">Tap between pages to split</span>
      </div>
    </Transition>

    <!-- Move mode header -->
    <Transition name="slide-down">
      <div
        v-if="isMove"
        class="sticky top-0 z-20 bg-accent px-4 py-3 flex items-center justify-center text-accent-foreground border-b border-accent/50 shadow-sm"
      >
        <span class="text-sm font-medium">
          Tap where to move {{ selectedCount }} page{{ selectedCount > 1 ? 's' : '' }}
        </span>
      </div>
    </Transition>

    <!-- Page Grid -->
    <div class="grid gap-3 p-4 min-h-[50vh]" :style="gridStyle">
      <template v-for="(pageRef, index) in localPages" :key="pageRef.id">
        <!-- Split marker before this page (in Split mode) -->
        <button
          v-if="isSplit && splitTargets.has(index)"
          class="col-span-full h-12 -my-1 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/10 transition-colors"
          @click="handleSplitMarkerTap(index)"
        >
          <Scissors class="w-4 h-4" />
          <span>Split here</span>
        </button>

        <!-- Drop marker before this page (in Move mode) -->
        <button
          v-if="isMove && dropTargets.has(index) && !selectedIds.has(pageRef.id)"
          class="col-span-full h-12 -my-1 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/10 transition-colors"
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
            :problem-severity="getProblemSeverity(pageRef.id)"
            :problem-messages="getProblemMessages(pageRef.id)"
            class="pointer-events-none"
          />
        </div>
      </template>

      <!-- Drop marker at end (in Move mode) -->
      <button
        v-if="isMove && dropTargets.has(localPages.length)"
        class="col-span-full h-12 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/10 transition-colors"
        @click="handleDropMarkerTap(localPages.length)"
      >
        <ArrowDown class="w-4 h-4" />
        <span>Move to end</span>
      </button>
    </div>

    <!-- Helper text -->
    <p v-if="contentPages.length > 0 && !isMove && !isSplit" class="text-center ui-caption py-4 px-6">
      <template v-if="isSelect"> Tap pages to select </template>
      <template v-else> Long-press to select / Tap to preview </template>
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

