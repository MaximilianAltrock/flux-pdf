<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import type { PageReference } from '@/types'

const props = defineProps<{
  pageRef: PageReference
  pageNumber: number
  selected?: boolean
  width?: number
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
  preview: []
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

const thumbnailWidth = computed(() => props.width ?? 220)

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
    threshold: 0
  }
)

async function loadThumbnail() {
  if (thumbnailUrl.value || isLoading.value) return

  isLoading.value = true
  hasError.value = false

  try {
    const url = await renderThumbnail(props.pageRef, thumbnailWidth.value)
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
  }
)

// Watch for sourceFileId changes (page might be from different source after undo)
watch(
  () => props.pageRef.sourceFileId,
  () => {
    if (hasBeenVisible.value) {
      thumbnailUrl.value = null
      loadThumbnail()
    }
  }
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
    class="page-thumbnail flex flex-col items-center gap-2 p-2 rounded-lg cursor-pointer select-none"
    :class="{
      'bg-primary/10 ring-2 ring-primary': selected,
      'hover:bg-muted/20': !selected
    }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Thumbnail container -->
    <div
      class="relative bg-background rounded shadow-md overflow-hidden"
      :style="{ width: `${thumbnailWidth}px` }"
    >
      <!-- Placeholder for not-yet-visible items (maintains layout) -->
      <div
        v-if="!hasBeenVisible"
        class="aspect-[8.5/11] bg-muted/20 flex items-center justify-center"
      >
        <span class="text-text-muted/50 text-xs">{{ pageNumber }}</span>
      </div>

      <!-- Loading skeleton -->
      <div
        v-else-if="isLoading && !thumbnailUrl"
        class="aspect-[8.5/11] bg-muted/30 animate-pulse flex items-center justify-center"
      >
        <svg
          class="w-8 h-8 text-text-muted/50 animate-spin"
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

      <!-- Error state -->
      <div
        v-else-if="hasError"
        class="aspect-[8.5/11] bg-danger/10 flex flex-col items-center justify-center gap-2 text-danger"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-xs">Failed to load</span>
        <button
          class="text-xs underline hover:no-underline"
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
        class="w-full h-auto"
        loading="lazy"
      />

      <!-- Selection indicator -->
      <div
        v-if="selected"
        class="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
      >
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <!-- Loading overlay when re-rendering (e.g., after rotation) -->
      <div
        v-if="isLoading && thumbnailUrl"
        class="absolute inset-0 bg-background/50 flex items-center justify-center"
      >
        <svg
          class="w-6 h-6 text-primary animate-spin"
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

      <!-- Preview hint on hover -->
      <div
        v-if="thumbnailUrl && !isLoading"
        class="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-end justify-center pb-3 opacity-0 hover:opacity-100"
      >
        <span class="text-xs text-white bg-black/70 px-2 py-1 rounded">
          Double-click to preview
        </span>
      </div>
    </div>

    <!-- Page number label -->
    <span
      class="text-sm font-medium"
      :class="selected ? 'text-primary' : 'text-text-muted'"
    >
      {{ pageNumber }}
    </span>
  </div>
</template>
