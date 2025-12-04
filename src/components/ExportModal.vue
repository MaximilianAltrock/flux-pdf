<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { X, Download, FileText, CheckCircle, AlertCircle } from 'lucide-vue-next'
import { usePdfExport } from '@/composables/usePdfExport'
import { useDocumentStore } from '@/stores/document'

const props = defineProps<{
  open: boolean
  exportSelected?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useDocumentStore()
const { 
  isExporting, 
  exportProgress, 
  exportError, 
  exportPdf, 
  exportSelectedPages,
  getSuggestedFilename 
} = usePdfExport()

const filename = ref('')
const exportComplete = ref(false)

// Reset state when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    filename.value = getSuggestedFilename()
    exportComplete.value = false
  }
})

const pageCount = computed(() => {
  if (props.exportSelected) {
    return store.selectedCount
  }
  return store.pageCount
})

const canExport = computed(() => {
  return filename.value.trim().length > 0 && !isExporting.value && !exportComplete.value
})

async function handleExport() {
  try {
    if (props.exportSelected) {
      await exportSelectedPages(filename.value.trim())
    } else {
      await exportPdf(filename.value.trim())
    }
    exportComplete.value = true
  } catch (error) {
    // Error is already handled in the composable
  }
}

function handleClose() {
  if (!isExporting.value) {
    emit('close')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !isExporting.value) {
    emit('close')
  }
  if (event.key === 'Enter' && canExport.value) {
    handleExport()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="open" 
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="handleClose"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" />
        
        <!-- Modal -->
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">
              {{ exportSelected ? 'Export Selected Pages' : 'Export PDF' }}
            </h2>
            <button
              class="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              :disabled="isExporting"
              @click="handleClose"
            >
              <X class="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <!-- Content -->
          <div class="px-6 py-4">
            <!-- Export complete state -->
            <div v-if="exportComplete" class="text-center py-6">
              <CheckCircle class="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">Export Complete!</h3>
              <p class="text-sm text-gray-500">
                Your PDF has been downloaded successfully.
              </p>
            </div>
            
            <!-- Error state -->
            <div v-else-if="exportError" class="text-center py-6">
              <AlertCircle class="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">Export Failed</h3>
              <p class="text-sm text-red-600">
                {{ exportError }}
              </p>
            </div>
            
            <!-- Exporting state -->
            <div v-else-if="isExporting" class="py-6">
              <div class="flex items-center justify-center gap-3 mb-4">
                <svg 
                  class="w-6 h-6 text-flux-500 animate-spin" 
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
                <span class="text-gray-700 font-medium">Generating PDF...</span>
              </div>
              
              <!-- Progress bar -->
              <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  class="h-full bg-flux-500 transition-all duration-300 ease-out"
                  :style="{ width: `${exportProgress}%` }"
                />
              </div>
              <p class="text-center text-sm text-gray-500 mt-2">
                {{ exportProgress }}% complete
              </p>
            </div>
            
            <!-- Form state -->
            <div v-else>
              <!-- File info -->
              <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                <FileText class="w-8 h-8 text-flux-500" />
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    {{ pageCount }} page{{ pageCount === 1 ? '' : 's' }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ exportSelected ? 'Selected pages will be exported' : 'All pages will be exported' }}
                  </p>
                </div>
              </div>
              
              <!-- Filename input -->
              <div>
                <label for="filename" class="block text-sm font-medium text-gray-700 mb-1">
                  Filename
                </label>
                <div class="flex items-center gap-2">
                  <input
                    id="filename"
                    v-model="filename"
                    type="text"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-flux-500 focus:border-flux-500 outline-none transition-shadow"
                    placeholder="Enter filename"
                    @keydown.enter="canExport && handleExport()"
                  />
                  <span class="text-gray-500">.pdf</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              v-if="!exportComplete"
              class="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              :disabled="isExporting"
              @click="handleClose"
            >
              Cancel
            </button>
            
            <button
              v-if="exportComplete"
              class="flex items-center gap-2 px-4 py-2 bg-flux-500 text-white rounded-lg hover:bg-flux-600 transition-colors"
              @click="handleClose"
            >
              Done
            </button>
            
            <button
              v-else-if="exportError"
              class="flex items-center gap-2 px-4 py-2 bg-flux-500 text-white rounded-lg hover:bg-flux-600 transition-colors"
              @click="exportError = null"
            >
              Try Again
            </button>
            
            <button
              v-else
              class="flex items-center gap-2 px-4 py-2 bg-flux-500 text-white rounded-lg hover:bg-flux-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canExport"
              @click="handleExport"
            >
              <Download class="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
