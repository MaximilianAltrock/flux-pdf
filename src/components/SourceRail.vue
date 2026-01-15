<script setup lang="ts">
import { ref, computed } from 'vue'
import { GripVertical, FileUp, X } from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ResizablePanel } from '@/components/ui/resizable'
import { formatBytes } from '@/utils/format'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const files = computed(() => props.state.document.sourceFileList)

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
    await props.actions.handleFilesSelected(droppedFiles)
  }
}
</script>

<template>
  <ResizablePanel as-child :default-size="15" :min-size="10" :max-size="20">
    <aside
      class="bg-sidebar border-r flex flex-col relative group/rail h-full min-w-0"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- Header -->
      <div
        class="h-12 flex items-center justify-between px-3 shrink-0 border-b border-border/40 bg-muted/10 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2">
          <h2 class="text-xxs font-bold text-muted-foreground uppercase tracking-[0.15em]">
            Source Registry
          </h2>
        </div>
      </div>

      <!-- Drag Over Overlay hint -->
      <div
        v-if="isDragOver"
        class="absolute inset-x-2 top-14 bottom-2 border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg z-50 flex items-center justify-center backdrop-blur-[2px] transition-all"
      >
        <div class="text-center p-4">
          <FileUp class="w-8 h-8 text-primary mx-auto mb-2 animate-bounce" />
          <p class="text-xs font-bold text-primary uppercase tracking-widest">Drop PDFs here</p>
        </div>
      </div>
      <!-- Content -->
      <ScrollArea class="flex-1 bg-background/5">
        <div class="p-3 space-y-2">
          <div
            v-for="file in files"
            :key="file.id"
            class="ide-card cursor-grab active:cursor-grabbing select-none"
            draggable="true"
            @dragstart="handleDragStart($event, file.id)"
          >
            <div class="flex items-stretch min-h-[52px]">
              <!-- Color Indicator -->
              <div
                class="w-1 shrink-0"
                :style="{ backgroundColor: props.state.document.getSourceColor(file.id) }"
              ></div>

              <div class="flex-1 flex flex-col min-w-0 p-2 justify-center">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs text-foreground font-bold truncate leading-tight flex-1">
                      {{ file.filename }}
                    </span>

                    <div
                      class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-5 w-5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-[2px]"
                            @click="handleRemove(file.id, $event)"
                          >
                            <X class="w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Remove Source</TooltipContent>
                      </Tooltip>
                      <GripVertical class="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <div
                      class="flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded-[2px] border border-border/10"
                    >
                      <span class="text-tiny font-mono font-bold text-muted-foreground uppercase"
                        >PDF</span
                      >
                      <span class="text-tiny text-muted-foreground/50">•</span>
                      <span class="text-tiny font-mono font-medium text-muted-foreground"
                        >{{ file.pageCount }}p</span
                      >
                    </div>
                    <span class="text-tiny text-muted-foreground font-mono">
                      {{ formatBytes(file.fileSize) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <Empty
            v-if="files.length === 0"
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
              <EmptyTitle class="text-xs font-medium text-muted-foreground"
                >No files imported</EmptyTitle
              >
              <EmptyDescription class="text-xxs text-muted-foreground opacity-50"
                >Drop PDFs here to start</EmptyDescription
              >
            </EmptyHeader>
          </Empty>
        </div>
      </ScrollArea>
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
