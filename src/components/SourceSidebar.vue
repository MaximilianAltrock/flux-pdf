<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { FileText, X, ChevronRight } from 'lucide-vue-next'
import { formatFileSize } from '@/utils/format'

const emit = defineEmits<{
  removeSource: [sourceId: string]
}>()

const store = useDocumentStore()

const sources = computed(() => store.sourceFileList)

function getPageCountForSource(sourceId: string): number {
  return store.pages.filter((p) => p.sourceFileId === sourceId).length
}

function handleRemove(sourceId: string, event: Event) {
  event.stopPropagation()
  emit('removeSource', sourceId)
}
</script>

<template>
  <aside class="w-64 bg-surface border-r border-border flex flex-col">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-border">
      <h2 class="text-sm font-semibold text-text">Source Files</h2>
      <p class="text-xs text-text-muted mt-0.5">
        {{ sources.length }} file{{ sources.length === 1 ? '' : 's' }} loaded
      </p>
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="sources.length === 0" class="p-4 text-center">
        <FileText class="w-10 h-10 text-text-muted/50 mx-auto mb-2" />
        <p class="text-sm text-text-muted">No files loaded</p>
        <p class="text-xs text-text-muted mt-1">Drop PDFs to get started</p>
      </div>

      <ul v-else class="py-2">
        <li
          v-for="source in sources"
          :key="source.id"
          class="group px-3 py-2 hover:bg-muted/20 cursor-default"
        >
          <div class="flex items-start gap-3">
            <!-- Icon -->
            <div
              class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded flex items-center justify-center"
            >
              <FileText class="w-4 h-4 text-primary" />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text truncate" :title="source.filename">
                {{ source.filename }}
              </p>
              <p class="text-xs text-text-muted mt-0.5">
                {{ getPageCountForSource(source.id) }} of {{ source.pageCount }} pages
                <span class="text-text-muted/50 mx-1">•</span>
                {{ formatFileSize(source.fileSize) }}
              </p>
            </div>

            <!-- Remove button -->
            <button
              class="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted/30 transition-all"
              title="Remove file"
              @click="handleRemove(source.id, $event)"
            >
              <X class="w-4 h-4 text-text-muted" />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Footer hint -->
    <div class="px-4 py-3 border-t border-border bg-muted/5">
      <p class="text-xs text-text-muted">
        <ChevronRight class="w-3 h-3 inline -mt-0.5" />
        Drag pages in the grid to reorder
      </p>
    </div>
  </aside>
</template>
