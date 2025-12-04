<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { FileText, X, ChevronRight } from 'lucide-vue-next'

const emit = defineEmits<{
  removeSource: [sourceId: string]
}>()

const store = useDocumentStore()

const sources = computed(() => store.sourceFileList)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getPageCountForSource(sourceId: string): number {
  return store.pages.filter(p => p.sourceFileId === sourceId).length
}

function handleRemove(sourceId: string, event: Event) {
  event.stopPropagation()
  emit('removeSource', sourceId)
}
</script>

<template>
  <aside class="w-64 bg-white border-r border-gray-200 flex flex-col">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200">
      <h2 class="text-sm font-semibold text-gray-700">Source Files</h2>
      <p class="text-xs text-gray-400 mt-0.5">
        {{ sources.length }} file{{ sources.length === 1 ? '' : 's' }} loaded
      </p>
    </div>
    
    <!-- File list -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="sources.length === 0" class="p-4 text-center">
        <FileText class="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p class="text-sm text-gray-400">No files loaded</p>
        <p class="text-xs text-gray-400 mt-1">Drop PDFs to get started</p>
      </div>
      
      <ul v-else class="py-2">
        <li
          v-for="source in sources"
          :key="source.id"
          class="group px-3 py-2 hover:bg-gray-50 cursor-default"
        >
          <div class="flex items-start gap-3">
            <!-- Icon -->
            <div class="flex-shrink-0 w-8 h-8 bg-flux-100 rounded flex items-center justify-center">
              <FileText class="w-4 h-4 text-flux-600" />
            </div>
            
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate" :title="source.filename">
                {{ source.filename }}
              </p>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ getPageCountForSource(source.id) }} of {{ source.pageCount }} pages
                <span class="text-gray-300 mx-1">•</span>
                {{ formatFileSize(source.fileSize) }}
              </p>
            </div>
            
            <!-- Remove button -->
            <button
              class="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all"
              title="Remove file"
              @click="handleRemove(source.id, $event)"
            >
              <X class="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </li>
      </ul>
    </div>
    
    <!-- Footer hint -->
    <div class="px-4 py-3 border-t border-gray-200 bg-gray-50">
      <p class="text-xs text-gray-500">
        <ChevronRight class="w-3 h-3 inline -mt-0.5" />
        Drag pages in the grid to reorder
      </p>
    </div>
  </aside>
</template>
