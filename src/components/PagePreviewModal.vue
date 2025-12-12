<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { useSwipe } from '@vueuse/core'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'
import { useMobile } from '@/composables'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps<{
  open: boolean
  pageRef: PageReference | null
}>()

const emit = defineEmits<{
  close: []
  navigate: [pageRef: PageReference]
}>()

const store = useDocumentStore()
const { renderThumbnail } = useThumbnailRenderer()
const { isMobile, onBackButton } = useMobile()

const dialogRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

// --- State ---
const previewUrl = ref<string | null>(null)
const isLoading = ref(false)
const zoom = ref(1)
const containerRef = ref<HTMLElement | null>(null) // For Swipe detection
const imageRef = ref<HTMLElement | null>(null) // For Zoom calculations

// --- Computed Helpers ---
const currentIndex = computed(() => {
  if (!props.pageRef) return -1
  return store.pages.findIndex((p) => p.id === props.pageRef!.id)
})

const nextContentIndex = computed(() => findNextContentPage(currentIndex.value, 'next'))
const prevContentIndex = computed(() => findNextContentPage(currentIndex.value, 'prev'))
const hasPrevious = computed(() => prevContentIndex.value !== -1)
const hasNext = computed(() => nextContentIndex.value !== -1)
const pageNumber = computed(() => currentIndex.value + 1)
const totalPages = computed(() => store.pages.length)

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
    // Mobile needs less resolution (speed), Desktop needs more (quality)
    const res = isMobile.value ? 600 : 1000
    const url = await renderThumbnail(props.pageRef, res, 2)
    previewUrl.value = url
  } catch (error) {
    console.error('Preview load error:', error)
  } finally {
    isLoading.value = false
  }
}

function handleClose() {
  emit('close')
}

// Navigation Helper
  function findNextContentPage(startIndex: number, direction: 'next' | 'prev'): number {
    let i = startIndex
    const delta = direction === 'next' ? 1 : -1
    while (i >= 0 && i < store.pages.length) {
      i += delta
      const page = store.pages[i]
      if (page && !page.isDivider) return i
    }
    return -1
  }

function goToPrevious() {
  const prevPage = store.pages[prevContentIndex.value]
  if (hasPrevious.value && prevPage) emit('navigate', prevPage)
}

function goToNext() {
  const nextPage = store.pages[nextContentIndex.value]
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
// We attach swipe detection to the container
const { isSwiping } = useSwipe(containerRef, {
  threshold: 50, // Pixel distance to trigger
  onSwipeEnd(e, direction) {
    if (zoom.value > 1) return // Don't swipe if zoomed in (conflicts with pan)

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

useFocusTrap(
  computed(() => props.open),
  dialogRef,
  {
    onEscape: handleClose,
    initialFocus: () => closeButtonRef.value,
  },
)

// Mobile Back Button
onBackButton(
  computed(() => props.open),
  handleClose,
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <!--
         Responsive Container:
         Desktop: bg-background/95 (Glassy)
         Mobile: bg-black (Immersive)
      -->
      <div
        v-if="open && pageRef"
        ref="dialogRef"
        class="fixed inset-0 z-[100] flex flex-col touch-none"
        :class="isMobile ? 'bg-black' : 'bg-background/95'"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-preview-title"
      >
        <h2 id="page-preview-title" class="sr-only">Page preview</h2>
        <!-- Header / Controls -->
        <header
          class="flex items-center justify-between px-4 py-3 shrink-0 z-20 transition-opacity duration-300"
          :class="[
            isMobile
              ? 'absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent text-white'
              : 'bg-background border-b border-border',
            isSwiping ? 'opacity-0' : 'opacity-100',
          ]"
        >
          <div class="flex items-center gap-4">
            <span class="font-medium" :class="isMobile ? 'text-sm' : 'text-text'">
              Page {{ pageNumber }} <span class="opacity-60">/ {{ totalPages }}</span>
            </span>

            <!-- Zoom controls (Desktop Only) -->
            <div v-if="!isMobile" class="flex items-center gap-1">
              <button
                type="button"
                class="p-2 text-text-muted hover:text-text rounded-lg"
                aria-label="Zoom out"
                @click="zoomOut"
              >
                <ZoomOut class="w-5 h-5" />
              </button>
              <button
                type="button"
                class="px-3 py-1 text-sm text-text-muted hover:text-text rounded"
                @click="resetZoom"
              >
                {{ Math.round(zoom * 100) }}%
              </button>
              <button
                type="button"
                class="p-2 text-text-muted hover:text-text rounded-lg"
                aria-label="Zoom in"
                @click="zoomIn"
              >
                <ZoomIn class="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            ref="closeButtonRef"
            type="button"
            aria-label="Close preview"
            class="p-2 rounded-lg transition-colors"
            :class="
              isMobile
                ? 'text-white/80 active:bg-white/10'
                : 'text-text-muted hover:text-text hover:bg-muted/10'
            "
            @click="handleClose"
          >
            <X class="w-6 h-6" />
          </button>
        </header>

        <!-- Main Canvas -->
        <div
          ref="containerRef"
          class="flex-1 overflow-hidden flex items-center justify-center p-4 relative"
        >
          <!-- Loading -->
          <div v-if="isLoading" class="flex flex-col items-center gap-4">
            <svg
              class="w-10 h-10 animate-spin"
              :class="isMobile ? 'text-white' : 'text-primary'"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>

          <!-- Image -->
          <img
            v-else-if="previewUrl"
            ref="imageRef"
            :src="previewUrl"
            class="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
            :style="{ transform: `scale(${zoom})` }"
          />

          <!-- Mobile Swipe Hints (Optional, visible if zoomed out) -->
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
        <button
          v-if="!isMobile && hasPrevious"
          type="button"
          aria-label="Previous page"
          class="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-surface/80 hover:bg-surface text-text rounded-full shadow-lg border border-border"
          @click="goToPrevious"
        >
          <ChevronLeft class="w-6 h-6" />
        </button>

        <button
          v-if="!isMobile && hasNext"
          type="button"
          aria-label="Next page"
          class="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-surface/80 hover:bg-surface text-text rounded-full shadow-lg border border-border"
          @click="goToNext"
        >
          <ChevronRight class="w-6 h-6" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
