<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { useDocumentStore } from '@/stores/document'
import { RotateCw, Trash2 } from 'lucide-vue-next'
import type { PageReference } from '@/types'

const props = defineProps<{
  pageRef: PageReference
  pageNumber: number
  selected?: boolean
  width?: number
  fixedSize?: boolean
  isStartOfFile?: boolean
  isRazorActive?: boolean
  canSplit?: boolean
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
  preview: []
  rotate: []
  delete: []
}>()

const { renderThumbnail, cancelRender } = useThumbnailRenderer()

// Element ref for intersection observer
const containerRef = ref<HTMLElement | null>(null)

// State
const thumbnailUrl = ref<string | null>(null)
const isLoading = ref(false)
const hasError = ref(false)
const isVisible = ref(false)
const hasBeenVisible = ref(false)

const store = useDocumentStore()
const sourceColor = computed(() => {
  const source = store.sources.get(props.pageRef.sourceFileId)
  return source?.color || 'gray'
})

// Logic: Only apply pixel width if fixedSize is true (Desktop behavior)
const cssWidth = computed(() => (props.fixedSize ? `${props.width ?? 220}px` : '100%'))

// Logic: Render engine always needs a number. Default to 300 for mobile sharpness.
const renderTargetWidth = computed(() => props.width ?? 300)

// Intersection observer - only load when visible
const { stop: stopObserver } = useIntersectionObserver(
  containerRef,
  ([entry]) => {
    isVisible.value = entry?.isIntersecting ?? false

    if (entry?.isIntersecting && !hasBeenVisible.value) {
      hasBeenVisible.value = true
      loadThumbnail()
    }
  },
  {
    rootMargin: '200px', // Start loading 200px before coming into view
    threshold: 0,
  },
)

async function loadThumbnail() {
  if (thumbnailUrl.value || isLoading.value) return

  isLoading.value = true
  hasError.value = false

  try {
    const url = await renderThumbnail(props.pageRef, renderTargetWidth.value)
    thumbnailUrl.value = url
  } catch (error) {
    if ((error as Error).message !== 'Render aborted') {
      console.error('Thumbnail render error:', error)
      hasError.value = true
    }
  } finally {
    isLoading.value = false
  }
}

// Watch for rotation changes to re-render
watch(
  () => props.pageRef.rotation,
  () => {
    if (hasBeenVisible.value) {
      thumbnailUrl.value = null
      loadThumbnail()
    }
  },
)

// Watch for sourceFileId changes (page might be from different source after undo)
watch(
  [() => props.pageRef.sourceFileId, () => props.pageRef.sourcePageIndex, () => props.pageRef],
  () => {
    if (hasBeenVisible.value) {
      thumbnailUrl.value = null
      loadThumbnail()
    }
  },
  { deep: true },
)

onUnmounted(() => {
  stopObserver()
  cancelRender(props.pageRef.id)
})

function handleClick(event: MouseEvent) {
  emit('click', event)
}

function handleDoubleClick(event: MouseEvent) {
  event.stopPropagation()
  emit('preview')
}

function handleRetry() {
  hasError.value = false
  loadThumbnail()
}
</script>

<template>
  <div
    ref="containerRef"
    :data-page-id="pageRef.id"
    class="page-thumbnail flex flex-col items-center gap-2 p-2 rounded-lg cursor-pointer select-none relative group h-fit transition-all duration-300"
    :class="{
      'w-full': !fixedSize,
      'ring-2 ring-selection bg-selection/10': selected,
      'hover:bg-surface/50': !selected,
      'razor-cursor': isRazorActive && canSplit,
    }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Cut Indicator (shows on hover when razor is active and can split) -->
    <div
      v-if="isRazorActive && canSplit"
      class="cut-indicator absolute -left-2 top-0 bottom-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none"
    >
      <div class="h-full w-0.5 border-l-2 border-dashed border-danger"></div>
    </div>
    <!-- Thumbnail container -->
    <div
      class="thumbnail-paper relative bg-white rounded-none overflow-hidden transition-transform duration-200 border-l-[10px]"
      :class="{ 'scale-[1.02]': selected, 'w-full': !fixedSize }"
      :style="{ width: cssWidth, borderLeftColor: sourceColor }"
    >
      <!-- Placeholder for not-yet-visible items (maintains layout) -->
      <div
        v-if="!hasBeenVisible"
        class="aspect-[8.5/11] bg-muted/20 flex items-center justify-center pointer-events-none"
      ></div>

      <!-- Loading skeleton -->
      <div
        v-else-if="isLoading && !thumbnailUrl"
        class="aspect-[8.5/11] bg-muted/30 animate-pulse flex items-center justify-center pointer-events-none"
      >
        <svg class="w-8 h-8 text-text-muted/50 animate-spin" fill="none" viewBox="0 0 24 24">
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

      <!-- Error state -->
      <div
        v-else-if="hasError"
        class="aspect-[8.5/11] bg-danger/10 flex flex-col items-center justify-center gap-2 text-danger pointer-events-none"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span class="text-xs">Failed</span>
        <button
          class="text-xs underline hover:no-underline pointer-events-auto"
          @click.stop="handleRetry"
        >
          Retry
        </button>
      </div>

      <!-- Rendered thumbnail -->
      <img
        v-else-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="`Page ${pageNumber}`"
        class="w-full h-auto block select-none"
        loading="lazy"
      />

      <!-- Selection Ring (Border Overlay) -->
      <div
        v-if="selected"
        class="absolute inset-0 border-2 border-selection pointer-events-none z-10"
      ></div>

      <!-- Invisible UI Overlay (Gradient + Actions) -->
      <div
        v-if="!isLoading"
        class="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 z-20 flex flex-col justify-between p-2"
      >
        <!-- Top Actions -->
        <div class="flex items-start justify-between">
          <button
            class="p-1.5 bg-background/80 hover:bg-background text-text rounded shadow-sm backdrop-blur-sm transition-colors"
            @click.stop="emit('rotate')"
            title="Rotate"
          >
            <RotateCw class="w-3.5 h-3.5" />
          </button>

          <button
            class="p-1.5 bg-background/80 hover:bg-danger text-text hover:text-white rounded shadow-sm backdrop-blur-sm transition-colors"
            @click.stop="emit('delete')"
            title="Delete"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Bottom Hint -->
        <div class="flex justify-center pb-2">
          <span class="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm"
            >Double-click to preview</span
          >
        </div>
      </div>

      <!-- Page Number Tag -->
      <div
        class="absolute bottom-2 left-1/2 -translate-x-1/2 translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      >
        <span
          class="bg-surface text-text font-mono text-xs px-1.5 py-0.5 rounded shadow border border-border"
        >
          {{ pageNumber }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thumbnail-paper {
  box-shadow: var(--paper-shadow);
  border-top: var(--paper-border);
  border-right: var(--paper-border);
  border-bottom: var(--paper-border);
  border-left-style: solid;
}
</style>
