<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { useSwipe, useEventListener } from '@vueuse/core'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import type { PageReference } from '@/types'
import { useMobile } from '@/composables/useMobile'
import type { FacadeState } from '@/composables/useDocumentFacade'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{
  open: boolean
  pageRef: PageReference | null
  state: FacadeState
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  navigate: [pageRef: PageReference]
}>()

const { renderThumbnail } = useThumbnailRenderer()
const { isMobile, onBackButton } = useMobile()

// --- State ---
const previewUrl = ref<string | null>(null)
const isLoading = ref(false)
const zoom = ref(1)
const containerRef = ref<HTMLElement | null>(null)

// --- Computed Helpers ---
const contentPages = computed(() => props.state.document.contentPages)
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
const headerStyle = computed(() => {
  if (!isMobile.value) return undefined
  return {
    paddingTop: `calc(env(safe-area-inset-top, 0px) + 0.75rem)`,
    paddingLeft: `calc(env(safe-area-inset-left, 0px) + 1rem)`,
    paddingRight: `calc(env(safe-area-inset-right, 0px) + 1rem)`,
  }
})

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
      return
    }

    isLoading.value = true

    try {
      const res = isMobile.value ? 600 : 1200
      const url = await renderThumbnail(props.pageRef, res, 2)
      if (!canceled) {
        previewUrl.value = url
        zoom.value = 1
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

function handleClose() {
  emit('update:open', false)
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

// --- Mobile Gestures (Swipe) ---
useSwipe(containerRef, {
  threshold: 50,
  onSwipeEnd(e, direction) {
    if (zoom.value > 1) return
    if (direction === 'left') goToNext()
    if (direction === 'right') goToPrevious()
    if (direction === 'down' || direction === 'up') handleClose()
  },
})

// --- Keyboard ---
function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  switch (event.key) {
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
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent
      :show-close-button="false"
      class="max-w-none w-screen h-screen p-0 m-0 border-none flex flex-col gap-0 select-none overflow-hidden outline-none sm:max-w-none rounded-none bg-background"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>Page Preview - Page {{ pageNumber }}</DialogTitle>
      </DialogHeader>

      <header
        class="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0 z-40 transition-opacity duration-300 antialiased bg-card border-b border-border"
        :style="headerStyle"
      >
        <!-- Left Section: Meta / Page Counter -->
        <div class="flex items-center gap-6 min-w-0 sm:min-w-[200px]">
          <div class="flex flex-col">
            <span class="ui-kicker opacity-70 leading-none mb-1"> Page Preview </span>
            <span class="ui-mono text-sm font-medium text-foreground">
              PAGE {{ pageNumber.toString().padStart(2, '0') }}
              <span class="opacity-40">/ {{ totalPages.toString().padStart(2, '0') }}</span>
            </span>
          </div>
        </div>

        <!-- Center Section: Zoom Controls (Desktop Only) -->
        <div v-if="!isMobile" class="ui-panel-muted rounded-sm p-0.5 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            title="Zoom Out"
            @click="zoomOut"
          >
            <ZoomOut class="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 px-3 ui-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            @click="resetZoom"
          >
            {{ Math.round(zoom * 100) }}%
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            title="Zoom In"
            @click="zoomIn"
          >
            <ZoomIn class="w-4 h-4" />
          </Button>
        </div>
        <div v-else class="flex-1"></div>

        <!-- Right Section: Close -->
        <div class="flex items-center justify-end min-w-0 sm:min-w-[200px]">
          <DialogClose as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-transform duration-200 hover:rotate-90"
            >
              <X class="w-5 h-5" />
            </Button>
          </DialogClose>
        </div>
      </header>

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
          :src="previewUrl"
          class="max-w-full max-h-full object-contain transition-transform duration-200 shadow-lg bg-card select-none"
          :style="{ transform: `scale(${zoom})` }"
        />

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

      <!-- Desktop Navigation Arrows -->
      <div
        v-if="!isMobile"
        class="absolute inset-0 pointer-events-none flex items-center justify-between px-12"
      >
        <Button
          v-if="hasPrevious"
          variant="outline"
          size="icon"
          class="pointer-events-auto h-11 w-11 rounded-md shadow-sm transition-colors group"
          @click="goToPrevious"
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
          class="pointer-events-auto h-11 w-11 rounded-md shadow-sm transition-colors group"
          @click="goToNext"
        >
          <ChevronRight
            class="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors"
          />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
