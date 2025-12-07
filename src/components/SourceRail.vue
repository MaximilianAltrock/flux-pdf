<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { GripVertical, ChevronLeft, ChevronRight, FileUp, X } from 'lucide-vue-next'

const store = useDocumentStore()
const isCollapsed = ref(false)

const files = computed(() => store.sourceFileList)

function handleDragStart(event: DragEvent, sourceId: string) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/json', JSON.stringify({ type: 'source-file', sourceId }))
  }
}

const emit = defineEmits<{
  (e: 'remove-source', id: string): void
}>()

function handleRemove(fileId: string, event: Event) {
  event.stopPropagation()
  emit('remove-source', fileId)
}

const { loadPdfFiles } = usePdfManager()
const isDragOver = ref(false)
let dragCounter = 0

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true
  }
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  if (e.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter--
  if (dragCounter === 0) {
    isDragOver.value = false
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  dragCounter = 0

  const droppedFiles = e.dataTransfer?.files
  if (droppedFiles && droppedFiles.length > 0) {
    // Pass autoAddPages: false
    // We need to update loadPdfFiles signature first, or pass option object
    // Assuming we'll update usePdfManager next
    await loadPdfFiles(droppedFiles, false)
  }
}
</script>

<template>
  <aside
    class="bg-surface border-r border-border flex flex-col shrink-0 transition-all duration-300 relative group/rail"
    :class="isCollapsed ? 'w-12' : 'w-[240px]'"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Header -->
    <div class="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
      <h2 v-if="!isCollapsed" class="text-xs font-bold text-text-muted uppercase tracking-wider">Sources</h2>
      <div v-if="isCollapsed" class="w-full flex justify-center">
        <FileUp class="w-5 h-5 text-text-muted" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2">
      <div
        v-for="file in files"
        :key="file.id"
        class="bg-background border border-border rounded p-0 overflow-hidden group hover:border-border-focus transition-all relative select-none"
        draggable="true"
        @dragstart="handleDragStart($event, file.id)"
      >
        <div class="flex items-stretch h-14">
          <!-- Color Pill (Full Height) -->
          <div class="w-[4px] shrink-0" :style="{ backgroundColor: file.color }"></div>

          <!-- Content or Icon (Collapsed) -->
          <div class="flex-1 flex items-center min-w-0 pr-2">
            <div v-if="isCollapsed" class="w-full flex justify-center">
              <span class="text-[10px] font-mono text-text-muted font-bold truncate px-1">PDF</span>
            </div>

            <div v-else class="flex-1 min-w-0 pl-2 py-2">
               <div class="flex items-center justify-between gap-1 mb-0.5">
                <span class="text-xs text-text font-medium truncate leading-tight" :title="file.filename">
                  {{ file.filename }}
                </span>
                <div class="flex items-center gap-0.5">
                  <button
                    class="p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger/10 transition-all"
                    title="Remove source file"
                    @click="handleRemove(file.id, $event)"
                  >
                    <X class="w-3 h-3" />
                  </button>
                  <GripVertical class="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
                </div>
               </div>
               <div class="flex items-center gap-2 text-[10px] text-text-muted font-mono">
                 <span>{{ file.pageCount }} pgs</span>
                 <span>{{ (file.fileSize / 1024 / 1024).toFixed(1) }} MB</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="files.length === 0 && !isCollapsed" class="border-2 border-dashed border-border rounded-lg p-4 text-center mt-4">
        <p class="text-xs text-text-muted mb-1">No files imported</p>
        <p class="text-[10px] text-text-muted opacity-60">Drop PDFs here</p>
      </div>
    </div>

    <!-- Collapser -->
    <button
      class="absolute -right-3 bottom-4 bg-surface border border-border rounded-full p-0.5 text-text-muted hover:text-text shadow-sm opacity-0 group-hover/rail:opacity-100 transition-opacity z-10"
      @click="isCollapsed = !isCollapsed"
      :title="isCollapsed ? 'Expand' : 'Collapse'"
    >
      <ChevronRight v-if="isCollapsed" class="w-3 h-3" />
      <ChevronLeft v-else class="w-3 h-3" />
    </button>

    <!-- Drop Zone Overlay -->
    <div
      v-if="isDragOver"
      class="absolute inset-0 bg-primary/20 border-2 border-primary border-dashed z-20 flex items-center justify-center backdrop-blur-sm"
    >
      <div class="bg-surface p-3 rounded-lg shadow-lg text-center pointer-events-none">
        <FileUp class="w-8 h-8 text-primary mx-auto mb-2" />
        <p class="text-sm font-bold text-primary">Drop to Import</p>
      </div>
    </div>
  </aside>
</template>
