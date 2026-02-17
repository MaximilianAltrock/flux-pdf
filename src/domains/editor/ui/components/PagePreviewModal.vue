<script setup lang="ts">
import { ref, shallowRef, watch, computed, nextTick, onUnmounted, useTemplateRef } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import { useSwipe, useEventListener, useResizeObserver } from '@vueuse/core'
import { useThumbnailRenderer } from '@/domains/document/application/composables/useThumbnailRenderer'
import { useRedactionOverlay } from '@/domains/editor/ui/useRedactionOverlay'
import type { PageReference } from '@/shared/types'
import { useMobile } from '@/shared/composables/useMobile'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { UserAction } from '@/shared/types/actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import PreviewToolbar from '@/domains/editor/ui/components/preview/PreviewToolbar.vue'
import PreviewMobileActions from '@/domains/editor/ui/components/preview/PreviewMobileActions.vue'

const props = defineProps<{
  open: boolean
  pageRef: PageReference | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  navigate: [pageRef: PageReference]
}>()

const { renderThumbnail, getPageViewportSize } = useThumbnailRenderer()
const { isMobile, onBackButton } = useMobile()
const actions = useDocumentActionsContext()
const document = useDocumentStore()

// --- State ---
const previewUrl = shallowRef<string | null>(null)
const isLoading = shallowRef(false)
const zoom = shallowRef(1)
const containerRef = useTemplateRef<HTMLElement>('containerRef')
const imageRef = useTemplateRef<HTMLImageElement>('imageRef')
const overlayRef = useTemplateRef<HTMLDivElement>('overlayRef')
const pageViewportSize = ref<{ width: number; height: number } | null>(null)
const overlayReady = shallowRef(false)

// We track the geometric position of the image within the container
// This allows the overlay DIV to sit exactly on top of the image
const overlayMetrics = ref<{ left: number; top: number; width: number; height: number }>({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
})
let overlaySyncFrame: number | null = null

// --- Computed Helpers ---
const contentPages = computed(() => document.contentPages)
const currentIndex = computed(() => {
  if (!props.pageRef) return -1
  return contentPages.value.findIndex((p) => p.id === props.pageRef!.id)
})

const nextContentIndex = computed(() => findNextContentPage(currentIndex.value, 'next'))
const prevContentIndex = computed(() => findNextContentPage(currentIndex.value, 'prev'))
const hasPrevious = computed(() => prevContentIndex.value !== -1)
const hasNext = computed(() => nextContentIndex.value !== -1)
const pageNumber = computed(() => currentIndex.value + 1)
const totalPages = computed(() => contentPages.value.length)
const hasPreviewPage = computed(() => !!props.pageRef)
const pageRedactions = computed(() => props.pageRef?.redactions ?? [])
const pageSize = computed(() => getPageSizePoints(props.pageRef))

// CSS for the overlay container (matches image position)
const overlayStyle = computed(() => {
  const { width, height, left, top } = overlayMetrics.value
  if (!width || !height) return { display: 'none' }
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

// --- Redaction Composable ---
const {
  isRedactMode,
  overlayCursor,
  drawingRect,
  selectedIds,
  hasSelectedRedaction,

  // Actions
  toggleRedactMode,
  startDraw,
  startMove,
  startResize,
  handlePointerMove,
  handlePointerUp,
  deleteSelectedRedactions,
  clearSelection,
  getRedactionRect,
  resetRedactionState,
} = useRedactionOverlay({
  pageRef: computed(() => props.pageRef),
  pageRedactions,
  pageSize,
  overlayRef,
  overlayMetrics,
  actions,
  syncOverlayMetrics,
})

// --- Overlay Sync Logic ---
function syncOverlayMetrics() {
  const image = imageRef.value
  const container = containerRef.value
  if (!image || !container) {
    overlayReady.value = false
    return
  }
  const imageRect = image.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  // Calculate relative position
  overlayMetrics.value = {
    width: imageRect.width,
    height: imageRect.height,
    left: imageRect.left - containerRect.left,
    top: imageRect.top - containerRect.top,
  }
}

function clearOverlaySync() {
  if (overlaySyncFrame !== null) {
    cancelAnimationFrame(overlaySyncFrame)
    overlaySyncFrame = null
  }
}

// Stabilize the overlay position after image load/zoom
async function settleOverlayMetrics(maxFrames = 12) {
  await nextTick()
  overlayReady.value = false
  clearOverlaySync()
  let frames = 0
  let last = { ...overlayMetrics.value }

  const step = () => {
    syncOverlayMetrics()
    const current = overlayMetrics.value
    const stable =
      Math.abs(current.left - last.left) < 0.5 &&
      Math.abs(current.top - last.top) < 0.5 &&
      Math.abs(current.width - last.width) < 0.5 &&
      Math.abs(current.height - last.height) < 0.5

    last = { ...current }
    frames += 1

    if (stable || frames >= maxFrames) {
      overlayReady.value = true
      overlaySyncFrame = null
      return
    }

    overlaySyncFrame = requestAnimationFrame(step)
  }

  overlaySyncFrame = requestAnimationFrame(step)
}

// --- Watchers ---
watch(
  () => [props.open, props.pageRef?.id, props.pageRef?.rotation],
  async ([isOpen], _prev, onInvalidate) => {
    let canceled = false
    onInvalidate(() => {
      canceled = true
    })

    if (!isOpen || !props.pageRef) {
      previewUrl.value = null
      isLoading.value = false
      if (isRedactMode.value) toggleRedactMode() // Reset mode on close
      pageViewportSize.value = null
      overlayReady.value = false
      clearOverlaySync()
      return
    }

    isLoading.value = true

    try {
      const res = isMobile.value ? 600 : 1200
      const [url, viewportSize] = await Promise.all([
        renderThumbnail(props.pageRef, res, 2),
        getPageViewportSize(props.pageRef),
      ])
      if (!canceled) {
        previewUrl.value = url
        pageViewportSize.value = viewportSize
        zoom.value = 1
        resetRedactionState()
        settleOverlayMetrics()
      }
    } catch (error) {
      if (!canceled) {
        console.error('Preview load error:', error)
      }
    } finally {
      if (!canceled) {
        isLoading.value = false
      }
    }
  },
  { immediate: true },
)

function normalizeRotation(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return (((value as number) % 360) + 360) % 360
}

function getPageSizePoints(
  pageRef: PageReference | null,
): { width: number; height: number } | null {
  if (!pageRef) return null
  if (pageViewportSize.value) return pageViewportSize.value
  const source = document.sources.get(pageRef.sourceFileId)
  const metrics = source?.pageMetaData?.[pageRef.sourcePageIndex]
  const baseWidth = pageRef.width ?? metrics?.width
  const baseHeight = pageRef.height ?? metrics?.height
  if (!baseWidth || !baseHeight) return null

  let width = baseWidth
  let height = baseHeight

  const userRotation = normalizeRotation(pageRef.rotation)
  if (userRotation % 180 !== 0) {
    ;[width, height] = [height, width]
  }

  return { width, height }
}

function handleClose() {
  emit('update:open', false)
}

function handlePreviewAction(action: UserAction) {
  if (!props.pageRef) return
  actions.handleContextAction(action, props.pageRef)
}

function handleDelete() {
  handlePreviewAction(UserAction.DELETE)
  handleClose()
}

function handleImageLoad() {
  void settleOverlayMetrics()
}

function findNextContentPage(startIndex: number, direction: 'next' | 'prev'): number {
  let i = startIndex
  const delta = direction === 'next' ? 1 : -1
  while (i >= 0 && i < contentPages.value.length) {
    i += delta
    const page = contentPages.value[i]
    if (page) return i
  }
  return -1
}

function goToPrevious() {
  const prevPage = contentPages.value[prevContentIndex.value]
  if (hasPrevious.value && prevPage) emit('navigate', prevPage)
}

function goToNext() {
  const nextPage = contentPages.value[nextContentIndex.value]
  if (hasNext.value && nextPage) emit('navigate', nextPage)
}

// --- Zoom Logic ---
function zoomIn() {
  zoom.value = Math.min(zoom.value + 0.25, 3)
}
function zoomOut() {
  zoom.value = Math.max(zoom.value - 0.25, 0.5)
}
function resetZoom() {
  zoom.value = 1
}

watch(zoom, () => {
  settleOverlayMetrics()
})

useEventListener('resize', () => {
  settleOverlayMetrics()
})

useResizeObserver(imageRef, () => {
  syncOverlayMetrics()
})

useResizeObserver(containerRef, () => {
  syncOverlayMetrics()
})

// --- Mobile Gestures (Swipe) ---
useSwipe(containerRef, {
  threshold: 50,
  onSwipeEnd(e, direction) {
    if (isRedactMode.value) return // Disable swipe during editing
    if (zoom.value > 1) return
    if (direction === 'left') goToNext()
    if (direction === 'right') goToPrevious()
    if (direction === 'down' || direction === 'up') handleClose()
  },
})

// --- Keyboard ---
function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  const isCmd = event.metaKey || event.ctrlKey
  const isShift = event.shiftKey

  if (isCmd && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (isShift) actions.redo()
    else actions.undo()
    return
  }

  if (isRedactMode.value) {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (hasSelectedRedaction.value) {
        event.preventDefault()
        deleteSelectedRedactions()
        return
      }
    }
    if (event.key === 'Escape') {
      // Escape clears selection first, then closes modal
      if (hasSelectedRedaction.value) {
        clearSelection()
        return
      }
    }
  }

  switch (event.key) {
    case 'Escape':
      if (!isRedactMode.value || !hasSelectedRedaction.value) handleClose()
      break
    case 'ArrowLeft':
      goToPrevious()
      break
    case 'ArrowRight':
      goToNext()
      break
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
      zoomOut()
      break
    case '0':
      resetZoom()
      break
  }
}

useEventListener('keydown', handleKeydown)

onBackButton(
  computed(() => props.open),
  handleClose,
)

onUnmounted(() => {
  clearOverlaySync()
})
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent
      :show-close-button="false"
      class="fixed top-0 left-0 right-0 bottom-0 translate-x-0 translate-y-0 max-w-none w-screen h-screen h-[100dvh] min-h-[100svh] p-0 m-0 border-none flex flex-col gap-0 select-none overflow-hidden outline-none sm:max-w-none rounded-none bg-background"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>Page Preview - Page {{ pageNumber }}</DialogTitle>
        <DialogDescription>
          Preview the current page and swipe left or right to navigate between pages.
        </DialogDescription>
      </DialogHeader>

      <PreviewToolbar
        :page-number="pageNumber"
        :total-pages="totalPages"
        :is-mobile="isMobile"
        :zoom="zoom"
        :is-redact-mode="isRedactMode"
        :has-preview-page="hasPreviewPage"
        :has-selected-redaction="hasSelectedRedaction"
        @close="handleClose"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @reset-zoom="resetZoom"
        @toggle-redact="toggleRedactMode"
        @delete-selected-redactions="deleteSelectedRedactions"
      />

      <!-- Main Canvas -->
      <div
        ref="containerRef"
        class="flex-1 overflow-hidden flex items-center justify-center p-4 relative"
      >
        <!-- Skeleton for Loading -->
        <div v-if="isLoading && !previewUrl" class="w-full h-full flex items-center justify-center">
          <Skeleton class="w-[300px] h-[400px] rounded-lg shadow-lg" />
        </div>

        <!-- Image -->
        <img
          v-else-if="previewUrl"
          ref="imageRef"
          :src="previewUrl"
          class="max-w-full max-h-full object-contain transition-transform duration-200 shadow-lg bg-card select-none"
          :style="{ transform: `scale(${zoom})` }"
          :alt="`Preview of page ${pageNumber}`"
          @load="handleImageLoad"
        />

        <!-- Redaction Overlay Layer -->
        <div
          v-if="previewUrl"
          ref="overlayRef"
          class="absolute"
          :class="isRedactMode && overlayReady ? 'pointer-events-auto' : 'pointer-events-none'"
          :style="[
            overlayStyle, // Positions the overlay exactly on top of the image
            {
              cursor: overlayCursor,
              opacity: overlayReady ? '1' : '0',
              transition: 'opacity 120ms ease-out',
            },
          ]"
          style="touch-action: none"
          @pointerdown="startDraw"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
        >
          <!-- 1. Redaction Boxes -->
          <div
            v-for="redaction in pageRedactions"
            :key="redaction.id"
            class="absolute border border-white/20"
            :class="selectedIds.has(redaction.id) ? 'z-20 ring-2 ring-primary' : 'z-10'"
            :style="{
              left: getRedactionRect(redaction).left + 'px',
              top: getRedactionRect(redaction).top + 'px',
              width: getRedactionRect(redaction).width + 'px',
              height: getRedactionRect(redaction).height + 'px',
              backgroundColor: redaction.color,
            }"
            @pointerdown.stop="startMove($event, redaction.id, redaction)"
          >
            <!-- 2. Resize Handles (Only if selected) -->
            <template v-if="selectedIds.has(redaction.id)">
              <div
                class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-background border border-primary cursor-nwse-resize z-30"
                @pointerdown.stop="startResize($event, 'nw', redaction.id, redaction)"
              ></div>
              <div
                class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-background border border-primary cursor-nesw-resize z-30"
                @pointerdown.stop="startResize($event, 'ne', redaction.id, redaction)"
              ></div>
              <div
                class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-background border border-primary cursor-nesw-resize z-30"
                @pointerdown.stop="startResize($event, 'sw', redaction.id, redaction)"
              ></div>
              <div
                class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-background border border-primary cursor-nwse-resize z-30"
                @pointerdown.stop="startResize($event, 'se', redaction.id, redaction)"
              ></div>
            </template>
          </div>

          <!-- 3. Drawing Preview Box -->
          <div
            v-if="drawingRect"
            class="absolute bg-black/50 border border-primary z-50"
            :style="{
              left: drawingRect.left + 'px',
              top: drawingRect.top + 'px',
              width: drawingRect.width + 'px',
              height: drawingRect.height + 'px',
            }"
          ></div>
        </div>

        <!-- Mobile Swipe Hints -->
        <div
          v-if="isMobile && !isLoading && zoom === 1"
          class="absolute inset-0 flex justify-between pointer-events-none px-2 items-center opacity-30"
        >
          <ChevronLeft v-if="hasPrevious" class="w-8 h-8 text-muted-foreground" />
          <div v-else class="w-8"></div>
          <ChevronRight v-if="hasNext" class="w-8 h-8 text-muted-foreground" />
        </div>
      </div>

      <!-- Mobile Quick Actions Footer -->
      <PreviewMobileActions
        v-if="isMobile"
        :is-redact-mode="isRedactMode"
        :has-preview-page="hasPreviewPage"
        @toggle-redact="toggleRedactMode"
        @rotate="handlePreviewAction(UserAction.ROTATE_RIGHT)"
        @duplicate="handlePreviewAction(UserAction.DUPLICATE)"
        @delete="isRedactMode ? deleteSelectedRedactions() : handleDelete()"
      />

      <!-- Desktop Navigation Arrows (Hover) -->
      <div
        v-if="!isMobile"
        class="absolute inset-0 pointer-events-none flex items-center justify-between px-12"
      >
        <Button
          v-if="hasPrevious"
          variant="outline"
          size="icon"
          class="pointer-events-auto h-11 w-11 rounded-md shadow-sm transition-colors group bg-background/50 backdrop-blur hover:bg-background"
          @click="goToPrevious"
          aria-label="Previous page"
        >
          <ChevronLeft
            class="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors"
          />
        </Button>
        <div v-else class="w-14"></div>

        <Button
          v-if="hasNext"
          variant="outline"
          size="icon"
          class="pointer-events-auto h-11 w-11 rounded-md shadow-sm transition-colors group bg-background/50 backdrop-blur hover:bg-background"
          @click="goToNext"
          aria-label="Next page"
        >
          <ChevronRight
            class="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors"
          />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

