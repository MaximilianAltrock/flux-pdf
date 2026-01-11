<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { usePdfManager } from '@/composables/usePdfManager'
import { ChevronLeft, ChevronRight, GripVertical, FileUp, X } from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ResizablePanel } from '@/components/ui/resizable'
import { formatBytes } from '@/utils/format-size'

const store = useDocumentStore()

const files = computed(() => store.sourceFileList)

function handleDragStart(event: DragEvent, sourceId: string) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'source-file', sourceId }),
    )
  }
}

const emit = defineEmits<{
  removeSource: [id: string]
}>()

function handleRemove(fileId: string, event: Event) {
  event.stopPropagation()
  emit('removeSource', fileId)
}

const { loadPdfFiles } = usePdfManager()
const isDragOver = ref(false)
let dragCounter = 0

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter++
    isDragOver.value = true
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter--
    if (dragCounter === 0) {
      isDragOver.value = false
    }
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  dragCounter = 0

  const droppedFiles = e.dataTransfer?.files
  if (droppedFiles && droppedFiles.length > 0) {
    store.setLoading(true, 'Importing files...')
    const results = await loadPdfFiles(droppedFiles)
    for (const result of results) {
      if (result.success && result.sourceFile) {
        store.addSourceFile(result.sourceFile)
      }
    }
    store.setLoading(false)
  }
}
</script>

<template>
  <ResizablePanel
    as-child
    :default-size="18"
    :min-size="10"
    :max-size="30"
    :collapsed-size="5"
    collapsible
    v-slot="{ isCollapsed, collapse, expand }"
  >
    <aside
      class="bg-sidebar border-r flex flex-col relative group/rail h-full min-w-0"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- Header -->
      <div class="h-12 flex items-center justify-between px-4 shrink-0">
        <h2
          v-if="!isCollapsed"
          class="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]"
        >
          Source Files
        </h2>
        <div v-if="isCollapsed" class="w-full flex justify-center">
          <FileUp class="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      <!-- Content -->
      <ScrollArea class="flex-1">
        <div class="p-3 space-y-3">
          <div
            v-for="file in files"
            :key="file.id"
            class="bg-sidebar-accent border border-border overflow-hidden group hover:border-primary/50 hover:shadow-md transition-all relative select-none cursor-grab active:cursor-grabbing"
            draggable="true"
            @dragstart="handleDragStart($event, file.id)"
          >
            <div class="flex items-stretch min-h-[56px]">
              <!-- Color Pill -->
              <div class="w-1.5 shrink-0" :style="{ backgroundColor: file.color }"></div>

              <div class="flex-1 flex flex-col min-w-0 p-2 justify-center">
                <div v-if="isCollapsed" class="w-full flex justify-center">
                  <Badge variant="outline" class="text-xxs font-mono px-1 h-5">PDF</Badge>
                </div>

                <div v-else class="flex flex-col gap-1.5">
                  <div class="flex items-start justify-between gap-2">
                    <span
                      class="text-xs text-foreground font-semibold truncate leading-tight flex-1"
                    >
                      {{ file.filename }}
                    </span>

                    <div class="flex items-center gap-1 -mt-0.5">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                            @click="handleRemove(file.id, $event)"
                          >
                            <X class="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove Source</TooltipContent>
                      </Tooltip>
                      <GripVertical
                        class="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      class="text-xxs h-4 px-1.5 font-mono font-medium bg-muted/50"
                    >
                      {{ file.pageCount }}p
                    </Badge>
                    <span class="text-xxs text-muted-foreground font-mono opacity-60">
                      {{ formatBytes(file.fileSize) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <Empty
            v-if="files.length === 0 && !isCollapsed"
            class="border-2 border-dashed border-border rounded-2xl p-6 text-center mt-2 bg-muted/5 group/empty transition-colors hover:border-primary/30"
          >
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                class="w-10 h-10 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-3 group-hover/empty:bg-primary/5 transition-colors"
              >
                <FileUp
                  class="w-5 h-5 text-muted-foreground/50 group-hover/empty:text-primary/50"
                />
              </EmptyMedia>
              <EmptyTitle class="text-[11px] font-medium text-muted-foreground"
                >No files imported</EmptyTitle
              >
              <EmptyDescription class="text-xxs text-muted-foreground opacity-50"
                >Drop PDFs here to start</EmptyDescription
              >
            </EmptyHeader>
          </Empty>
        </div>
      </ScrollArea>

      <Button
        variant="outline"
        size="icon"
        class="absolute right-2 bottom-6 h-7 w-7 rounded-full bg-card border-border shadow-md opacity-0 group-hover/rail:opacity-100 transition-opacity z-10"
        @click="isCollapsed ? expand() : collapse()"
      >
        <ChevronRight v-if="isCollapsed" class="w-3.5 h-3.5" />
        <ChevronLeft v-else class="w-3.5 h-3.5" />
      </Button>
      <!-- Drop Zone Overlay -->
      <div
        v-if="isDragOver"
        class="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed z-20 flex items-center justify-center backdrop-blur-[2px] m-1 rounded-2xl"
      >
        <div
          class="bg-background/90 p-4 rounded-2xl shadow-2xl text-center pointer-events-none border border-primary/20 scale-110 transition-transform"
        >
          <FileUp class="w-8 h-8 text-primary mx-auto mb-2 animate-bounce" />
          <p class="text-xs font-bold text-primary uppercase tracking-widest">Release to Import</p>
        </div>
      </div>
    </aside>
  </ResizablePanel>
</template>
