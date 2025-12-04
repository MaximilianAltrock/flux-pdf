<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
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
}>()

const { renderThumbnail, cancelRender } = useThumbnailRenderer()

const thumbnailUrl = ref<string | null>(null)
const isLoading = ref(true)
const hasError = ref(false)

const thumbnailWidth = props.width ?? 220

async function loadThumbnail() {
  isLoading.value = true
  hasError.value = false
  
  try {
    const url = await renderThumbnail(props.pageRef, thumbnailWidth)
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
    thumbnailUrl.value = null
    loadThumbnail()
  }
)

onMounted(() => {
  loadThumbnail()
})

onUnmounted(() => {
  cancelRender(props.pageRef.id)
})

function handleClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<template>
  <div
    class="page-thumbnail flex flex-col items-center gap-2 p-2 rounded-lg cursor-pointer select-none"
    :class="{
      'bg-flux-50 ring-2 ring-flux-500': selected,
      'hover:bg-gray-50': !selected
    }"
    @click="handleClick"
  >
    <!-- Thumbnail container -->
    <div 
      class="relative bg-white rounded shadow-md overflow-hidden"
      :style="{ width: `${thumbnailWidth}px` }"
    >
      <!-- Loading skeleton -->
      <div 
        v-if="isLoading"
        class="aspect-[8.5/11] bg-gray-100 animate-pulse flex items-center justify-center"
      >
        <svg 
          class="w-8 h-8 text-gray-300 animate-spin" 
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
        class="aspect-[8.5/11] bg-red-50 flex flex-col items-center justify-center gap-2 text-red-500"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-xs">Failed to load</span>
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
        class="absolute top-2 right-2 w-6 h-6 bg-flux-500 rounded-full flex items-center justify-center"
      >
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
    
    <!-- Page number label -->
    <span 
      class="text-sm font-medium"
      :class="selected ? 'text-flux-700' : 'text-gray-600'"
    >
      {{ pageNumber }}
    </span>
  </div>
</template>
