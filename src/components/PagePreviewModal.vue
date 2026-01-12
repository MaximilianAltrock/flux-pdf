<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { useSwipe } from '@vueuse/core'
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
const imageRef = ref<HTMLElement | null>(null)

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

// --- Watchers ---
watch(
  () => [props.open, props.pageRef?.id, props.pageRef?.rotation],
  async () => {
    if (props.open && props.pageRef) {
      await loadPreview()
    }
  },
  { immediate: true },
)

// --- Logic ---
async function loadPreview() {
  if (!props.pageRef) return
  isLoading.value = true
  previewUrl.value = null
  zoom.value = 1

  try {
    const res = isMobile.value ? 600 : 1200
    const url = await renderThumbnail(props.pageRef, res, 2)
    previewUrl.value = url
  } catch (error) {
    console.error('Preview load error:', error)
  } finally {
    isLoading.value = false
  }
}

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
const { isSwiping } = useSwipe(containerRef, {
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

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

onBackButton(
  computed(() => props.open),
  handleClose,
)
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent
      :show-close-button="false"
      class="max-w-none w-screen h-screen p-0 m-0 border-none flex flex-col gap-0 select-none overflow-hidden outline-none sm:max-w-none rounded-none"
      :class="isMobile ? 'bg-black' : 'bg-background/98'"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>Page Preview - Page {{ pageNumber }}</DialogTitle>
      </DialogHeader>

      <!-- Header / Controls -->
      <header
        class="flex items-center justify-between px-6 py-3 shrink-0 z-40 transition-opacity duration-300 antialiased"
        :class="[
          isMobile
            ? 'absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent text-white'
            : 'glass-surface border-b border-border/40',
          isSwiping ? 'opacity-0' : 'opacity-100',
        ]"
      >
        <!-- Left Section: Meta / Page Counter -->
        <div class="flex items-center gap-6 min-w-[200px]">
          <div class="flex flex-col">
            <span
              class="text-xs font-semibold tracking-wider uppercase text-muted-foreground/80 mb-0.5"
            >
              Document Preview
            </span>
            <span
              class="text-sm font-medium font-mono"
              :class="isMobile ? 'text-white' : 'text-foreground'"
            >
              PAGE {{ pageNumber.toString().padStart(2, '0') }}
              <span class="opacity-40">/ {{ totalPages.toString().padStart(2, '0') }}</span>
            </span>
          </div>
        </div>

        <!-- Center Section: Zoom Controls (Desktop Only) -->
        <div
          v-if="!isMobile"
          class="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40"
        >
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/60"
            title="Zoom Out"
            @click="zoomOut"
          >
            <ZoomOut class="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 px-3 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-200"
            @click="resetZoom"
          >
            {{ Math.round(zoom * 100) }}%
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/60"
            title="Zoom In"
            @click="zoomIn"
          >
            <ZoomIn class="w-4 h-4" />
          </Button>
        </div>
        <div v-else class="flex-1"></div>

        <!-- Right Section: Close -->
        <div class="flex items-center justify-end min-w-[200px]">
          <DialogClose as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-10 w-10 transition-all duration-200 hover:rotate-90"
              :class="
                isMobile
                  ? 'text-white/80 active:bg-white/10'
                  : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
              "
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
        <div v-if="isLoading" class="w-full h-full flex items-center justify-center">
          <Skeleton class="w-[300px] h-[400px] rounded-lg shadow-2xl" />
        </div>

        <!-- Image -->
        <img
          v-else-if="previewUrl"
          ref="imageRef"
          :src="previewUrl"
          class="max-w-full max-h-full object-contain transition-transform duration-200 shadow-2xl bg-white select-none"
          :style="{ transform: `scale(${zoom})` }"
        />

        <!-- Mobile Swipe Hints -->
        <div
          v-if="isMobile && !isLoading && zoom === 1"
          class="absolute inset-0 flex justify-between pointer-events-none px-2 items-center opacity-30"
        >
          <ChevronLeft v-if="hasPrevious" class="w-8 h-8 text-white drop-shadow-md" />
          <div v-else class="w-8"></div>
          <ChevronRight v-if="hasNext" class="w-8 h-8 text-white drop-shadow-md" />
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
          class="pointer-events-auto h-14 w-14 rounded-full glass-surface shadow-2xl transition-all duration-300 hover:scale-110 hover:bg-background active:scale-95 border-border/40 group"
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
          class="pointer-events-auto h-14 w-14 rounded-full glass-surface shadow-2xl transition-all duration-300 hover:scale-110 hover:bg-background active:scale-95 border-border/40 group"
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
