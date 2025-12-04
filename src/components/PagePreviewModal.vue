<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { X, ChevronLeft, ChevronRight, RotateCw, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { useThumbnailRenderer } from '@/composables/useThumbnailRenderer'
import { useDocumentStore } from '@/stores/document'
import type { PageReference } from '@/types'

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

const previewUrl = ref<string | null>(null)
const isLoading = ref(false)
const zoom = ref(1)
const containerRef = ref<HTMLElement | null>(null)

// Get current page index in the document
const currentIndex = computed(() => {
  if (!props.pageRef) return -1
  return store.pages.findIndex(p => p.id === props.pageRef!.id)
})

const hasPrevious = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < store.pages.length - 1)

const pageNumber = computed(() => currentIndex.value + 1)
const totalPages = computed(() => store.pages.length)

// Load high-res preview when modal opens or page changes
watch(
  () => [props.open, props.pageRef?.id, props.pageRef?.rotation],
  async () => {
    if (props.open && props.pageRef) {
      await loadPreview()
    }
  },
  { immediate: true }
)

async function loadPreview() {
  if (!props.pageRef) return
  
  isLoading.value = true
  previewUrl.value = null
  zoom.value = 1
  
  try {
    // Render at higher resolution for preview (800px base width)
    const url = await renderThumbnail(props.pageRef, 800, 2)
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

function goToPrevious() {
  if (hasPrevious.value) {
    emit('navigate', store.pages[currentIndex.value - 1])
  }
}

function goToNext() {
  if (hasNext.value) {
    emit('navigate', store.pages[currentIndex.value + 1])
  }
}

function zoomIn() {
  zoom.value = Math.min(zoom.value + 0.25, 3)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value - 0.25, 0.5)
}

function resetZoom() {
  zoom.value = 1
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  
  switch (event.key) {
    case 'Escape':
      handleClose()
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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="open && pageRef" 
        class="fixed inset-0 z-50 flex flex-col bg-gray-900/95"
      >
        <!-- Header -->
        <header class="flex items-center justify-between px-4 py-3 bg-gray-900">
          <div class="flex items-center gap-4">
            <span class="text-white font-medium">
              Page {{ pageNumber }} of {{ totalPages }}
            </span>
            
            <!-- Zoom controls -->
            <div class="flex items-center gap-1">
              <button
                class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Zoom out (-)"
                @click="zoomOut"
              >
                <ZoomOut class="w-5 h-5" />
              </button>
              
              <button
                class="px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Reset zoom (0)"
                @click="resetZoom"
              >
                {{ Math.round(zoom * 100) }}%
              </button>
              
              <button
                class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Zoom in (+)"
                @click="zoomIn"
              >
                <ZoomIn class="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <!-- Keyboard hints -->
            <span class="text-xs text-gray-500 mr-4">
              ← → navigate • +/- zoom • Esc close
            </span>
            
            <button
              class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Close (Esc)"
              @click="handleClose"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </header>
        
        <!-- Main content -->
        <div 
          ref="containerRef"
          class="flex-1 overflow-auto flex items-center justify-center p-8"
        >
          <!-- Loading state -->
          <div v-if="isLoading" class="flex flex-col items-center gap-4">
            <svg 
              class="w-12 h-12 text-white animate-spin" 
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
            <span class="text-gray-400">Loading preview...</span>
          </div>
          
          <!-- Preview image -->
          <img 
            v-else-if="previewUrl"
            :src="previewUrl"
            :alt="`Page ${pageNumber}`"
            class="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-200"
            :style="{ transform: `scale(${zoom})` }"
          />
        </div>
        
        <!-- Navigation buttons -->
        <button
          v-if="hasPrevious"
          class="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full shadow-lg transition-colors"
          title="Previous page (←)"
          @click="goToPrevious"
        >
          <ChevronLeft class="w-6 h-6" />
        </button>
        
        <button
          v-if="hasNext"
          class="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full shadow-lg transition-colors"
          title="Next page (→)"
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
