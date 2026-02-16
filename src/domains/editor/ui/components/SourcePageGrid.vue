<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, useTemplateRef } from 'vue'
import { useEventListener, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import SourcePageThumbnail from './SourcePageThumbnail.vue'
import { useThumbnailRenderer } from '@/domains/document/application/useThumbnailRenderer'
import { ROTATION_DEFAULT_DEGREES } from '@/shared/constants'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useSourcePageSelection } from '@/domains/document/application/composables/useSourcePageSelection'

const props = defineProps<{
  sourceId: string
  pageCount: number
  sourceColor?: string
  tileWidth?: number
  maxHeight?: number
}>()

const { selectedPages, clearSelection, handlePageClick, handlePageDragStart } =
  useSourcePageSelection(() => props.sourceId)
const hoveredIndex = shallowRef<number | null>(null)
const previewIndex = shallowRef<number | null>(null)
const showPreview = shallowRef(false)
const previewUrl = shallowRef<string | null>(null)
const previewStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const previewWidth = 320
const previewRequestId = shallowRef(0)
const lastPreviewId = shallowRef<string | null>(null)
const isModifierDown = shallowRef(false)
const tileRefs = ref(new Map<number, HTMLElement>())
const previewDelayMs = 320
const { start: startPreviewTimer, stop: stopPreviewTimer } = useTimeoutFn(
  () => {
    showPreview.value = true
    positionPreview()
    if (previewIndex.value !== null) {
      void loadPreview(previewIndex.value)
    }
  },
  previewDelayMs,
  { immediate: false },
)

const { renderThumbnail, cancelRender } = useThumbnailRenderer()

const viewportRef = useTemplateRef<HTMLElement>('viewportRef')
const viewportWidth = shallowRef(0)
const viewportHeight = shallowRef(0)
const scrollTop = shallowRef(0)

const gap = 16
const tileWidth = computed(() => props.tileWidth ?? 84)
const tileHeight = computed(() => Math.round((tileWidth.value * 11) / 8.5))
const rowHeight = computed(() => tileHeight.value + gap)
const columns = computed(() =>
  Math.max(1, Math.floor((viewportWidth.value + gap) / (tileWidth.value + gap))),
)
const totalRows = computed(() => Math.ceil(props.pageCount / columns.value))
const totalHeight = computed(() => Math.max(0, totalRows.value * rowHeight.value - gap))
const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - 2))
const endRow = computed(() =>
  Math.min(
    totalRows.value,
    Math.ceil((scrollTop.value + viewportHeight.value) / rowHeight.value) + 2,
  ),
)
const offsetY = computed(() => startRow.value * rowHeight.value)

const visibleIndices = computed(() => {
  const items: number[] = []
  for (let row = startRow.value; row < endRow.value; row += 1) {
    for (let col = 0; col < columns.value; col += 1) {
      const index = row * columns.value + col
      if (index >= props.pageCount) break
      items.push(index)
    }
  }
  return items
})

function handleScroll() {
  if (!viewportRef.value) return
  scrollTop.value = viewportRef.value.scrollTop
  hidePreview()
}

function setViewportSize(width: number, height: number) {
  viewportWidth.value = width
  viewportHeight.value = height
}

onMounted(() => {
  if (!viewportRef.value) return
  const rect = viewportRef.value.getBoundingClientRect()
  setViewportSize(rect.width, rect.height)
})

useResizeObserver(viewportRef, (entries) => {
  const entry = entries[0]
  if (entry) setViewportSize(entry.contentRect.width, entry.contentRect.height)
})

onUnmounted(() => {
  if (lastPreviewId.value) {
    cancelRender(lastPreviewId.value)
  }
  clearPreviewTimer()
  tileRefs.value.clear()
})

useEventListener(viewportRef, 'scroll', handleScroll)

function setTileRef(
  el: Element | { $el?: Element } | null,
  index: number,
) {
  const element = el instanceof Element ? el : el?.$el instanceof Element ? el.$el : null
  if (!element) {
    tileRefs.value.delete(index)
    return
  }
  tileRefs.value.set(index, element as HTMLElement)
}

function canShowPreview() {
  return selectedPages.value.size <= 1 && !isModifierDown.value
}

function clearPreviewTimer() {
  stopPreviewTimer()
}

function hidePreview() {
  clearPreviewTimer()
  showPreview.value = false
  previewIndex.value = null
  previewUrl.value = null
}

function schedulePreview(index: number) {
  if (!canShowPreview()) return
  clearPreviewTimer()
  previewIndex.value = index
  previewUrl.value = null
  startPreviewTimer()
}

function handleTileEnter(index: number) {
  hoveredIndex.value = index
  schedulePreview(index)
}

function handleTileLeave(index: number) {
  if (hoveredIndex.value === index) {
    hoveredIndex.value = null
  }
  hidePreview()
}

function handleViewportLeave() {
  hoveredIndex.value = null
  hidePreview()
}

function handleViewportClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('[data-page-tile="true"]')) return
  clearSelection()
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columns.value}, ${tileWidth.value}px)`,
  gap: `${gap}px`,
}))

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function positionPreview() {
  if (previewIndex.value === null) return
  const tile =
    tileRefs.value.get(previewIndex.value) ??
    (viewportRef.value?.querySelector(
      `[data-page-index="${previewIndex.value}"]`,
    ) as HTMLElement | null)
  if (!tile) return

  const rect = tile.getBoundingClientRect()
  const previewHeight = (previewWidth * 11) / 8.5
  const padding = 8
  const offset = 12

  let left = rect.right + offset
  if (left + previewWidth > window.innerWidth - padding) {
    left = rect.left - previewWidth - offset
  }
  left = clamp(left, padding, window.innerWidth - previewWidth - padding)

  const top = clamp(
    rect.top,
    padding,
    Math.max(padding, window.innerHeight - previewHeight - padding),
  )

  previewStyle.value = { top: `${top}px`, left: `${left}px` }
}

async function loadPreview(index: number) {
  const requestId = ++previewRequestId.value
  const pageRefId = `${props.sourceId}:${index}:preview`
  if (lastPreviewId.value && lastPreviewId.value !== pageRefId) {
    cancelRender(lastPreviewId.value)
  }
  lastPreviewId.value = pageRefId

  try {
    const url = await renderThumbnail(
      {
        id: pageRefId,
        sourceFileId: props.sourceId,
        sourcePageIndex: index,
        rotation: ROTATION_DEFAULT_DEGREES,
      },
      previewWidth,
    )
    if (requestId !== previewRequestId.value) return
    previewUrl.value = url
  } catch {
    if (requestId !== previewRequestId.value) return
  }
}

watch(hoveredIndex, (next) => {
  if (next === null) {
    hidePreview()
  }
})

watch(
  () => selectedPages.value.size,
  (size) => {
    if (size > 1) hidePreview()
  },
)

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  isModifierDown.value = event.shiftKey || event.metaKey || event.ctrlKey
  if (isModifierDown.value) hidePreview()
})

useEventListener(window, 'keyup', (event: KeyboardEvent) => {
  isModifierDown.value = event.shiftKey || event.metaKey || event.ctrlKey
})

useEventListener(window, 'blur', () => {
  isModifierDown.value = false
})

useEventListener(
  window,
  'scroll',
  () => {
    if (showPreview.value) positionPreview()
  },
  { passive: true },
)

useEventListener(window, 'resize', () => {
  if (showPreview.value) positionPreview()
})
</script>

<template>
  <div
    ref="viewportRef"
    class="relative max-h-52 overflow-auto pr-1"
    :style="{ maxHeight: props.maxHeight ? `${props.maxHeight}px` : undefined }"
    @click="handleViewportClick"
    @pointerleave="handleViewportLeave"
  >
    <div class="relative" :style="{ height: `${totalHeight}px` }">
      <div class="absolute inset-x-0" :style="{ transform: `translateY(${offsetY}px)` }">
        <div class="grid" :style="gridStyle">
          <div
            v-for="pageIndex in visibleIndices"
            :key="`${props.sourceId}-${pageIndex}`"
            class="group/page cursor-grab active:cursor-grabbing bg-transparent p-0 text-left"
            draggable="true"
            data-page-tile="true"
            role="button"
            tabindex="0"
            :aria-label="`Drag page ${pageIndex + 1}`"
            :aria-pressed="selectedPages.has(pageIndex) ? 'true' : 'false'"
            @click.stop="handlePageClick($event, pageIndex)"
            @keydown.enter.prevent="handlePageClick($event as unknown as MouseEvent, pageIndex)"
            @keydown.space.prevent="handlePageClick($event as unknown as MouseEvent, pageIndex)"
            @pointerenter="handleTileEnter(pageIndex)"
            @pointerleave="handleTileLeave(pageIndex)"
            @dragstart="handlePageDragStart($event, pageIndex)"
            :data-page-index="pageIndex"
            :ref="(el) => setTileRef(el, pageIndex)"
          >
            <SourcePageThumbnail
              :source-id="props.sourceId"
              :page-index="pageIndex"
              :page-number="pageIndex + 1"
              :source-color="props.sourceColor"
              :width="tileWidth"
              :selected="selectedPages.has(pageIndex)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="showPreview && previewIndex !== null"
      class="fixed z-[200] pointer-events-none"
      :style="previewStyle"
    >
      <div
        class="p-2 bg-card text-foreground border border-border/70 shadow-lg rounded-md"
        :style="{ width: `${previewWidth}px` }"
      >
        <img
          v-if="previewUrl"
          :src="previewUrl"
          :alt="`Page ${previewIndex + 1} preview`"
          class="w-full h-auto block rounded-sm"
          draggable="false"
        />
        <div v-else class="aspect-[8.5/11] bg-muted/20 rounded-sm flex items-center justify-center">
          <Skeleton class="w-full h-full rounded-sm opacity-60" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
