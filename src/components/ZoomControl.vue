<script setup lang="ts">
import { ZoomIn, ZoomOut } from 'lucide-vue-next'
import { useThumbnailZoom } from '@/composables/useThumbnailZoom'

const { 
  zoomLevel, 
  minZoom, 
  maxZoom, 
  setZoom, 
  zoomIn, 
  zoomOut,
  canZoomIn,
  canZoomOut
} = useThumbnailZoom()

function handleSliderChange(event: Event) {
  const value = parseInt((event.target as HTMLInputElement).value, 10)
  setZoom(value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      class="p-1.5 rounded transition-colors"
      :class="canZoomOut 
        ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' 
        : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
      :disabled="!canZoomOut"
      title="Zoom out"
      @click="zoomOut"
    >
      <ZoomOut class="w-4 h-4" />
    </button>
    
    <input
      type="range"
      :min="minZoom"
      :max="maxZoom"
      :value="zoomLevel"
      step="20"
      class="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-flux-500"
      title="Thumbnail size"
      @input="handleSliderChange"
    />
    
    <button
      class="p-1.5 rounded transition-colors"
      :class="canZoomIn 
        ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' 
        : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
      :disabled="!canZoomIn"
      title="Zoom in"
      @click="zoomIn"
    >
      <ZoomIn class="w-4 h-4" />
    </button>
  </div>
</template>

<style scoped>
/* Custom slider styling */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0ea5e9;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0ea5e9;
  cursor: pointer;
  border: none;
}
</style>
