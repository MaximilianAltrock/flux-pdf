<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ChevronRight, GripVertical, FileUp, X } from 'lucide-vue-next'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Button } from '@/shared/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/components/ui/empty'
import { ResizablePanel } from '@/shared/components/ui/resizable'
import SourcePageGrid from './SourcePageGrid.vue'
import { formatBytes } from '@/shared/utils/format'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'

const actions = useDocumentActionsContext()
const document = useDocumentStore()

const files = computed(() => document.sourceFileList)
const expandedSources = ref<Record<string, boolean>>({})

function handleDragStart(event: DragEvent, sourceId: string) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-flux-source-file', sourceId)
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'source-file', sourceId }),
    )
  }
}

function toggleSource(sourceId: string) {
  expandedSources.value[sourceId] = !expandedSources.value[sourceId]
}

function isSourceExpanded(sourceId: string) {
  return Boolean(expandedSources.value[sourceId])
}

const emit = defineEmits<{
  removeSource: [id: string]
}>()

function handleRemove(fileId: string, event: Event) {
  event.stopPropagation()
  if (expandedSources.value[fileId]) {
    delete expandedSources.value[fileId]
  }
  emit('removeSource', fileId)
}

const isDragOver = shallowRef(false)
let dragCounter = 0

function resetDragState() {
  isDragOver.value = false
  dragCounter = 0
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter += 1
    if (!isDragOver.value) {
      isDragOver.value = true
    }
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter = Math.max(0, dragCounter - 1)
    if (dragCounter === 0) {
      isDragOver.value = false
    }
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  resetDragState()

  const droppedFiles = e.dataTransfer?.files
  if (droppedFiles && droppedFiles.length > 0) {
    await actions.handleSourcesSelected(droppedFiles)
  }
}

function handleWindowDragLeave(e: DragEvent) {
  if (e.relatedTarget === null) {
    resetDragState()
  }
}

useEventListener('dragend', resetDragState)
useEventListener('drop', resetDragState)
useEventListener('dragleave', handleWindowDragLeave)
</script>

<template>
  <ResizablePanel as-child :default-size="15" :min-size="10" :max-size="20">
    <aside
      class="bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex flex-col relative group/rail h-full min-w-0"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- Header -->
      <div
        class="h-12 flex items-center justify-between px-3 shrink-0 border-b border-sidebar-border/40 bg-sidebar"
      >
        <div class="flex items-center gap-2">
          <h2 class="ui-kicker">Source Registry</h2>
        </div>
      </div>

      <!-- Drag Over Overlay -->
      <div
        v-if="isDragOver"
        class="pointer-events-none absolute inset-x-2 top-14 bottom-2 rounded-lg border border-primary/30 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent backdrop-blur-sm z-50 flex items-center justify-center"
      >
        <div
          class="ui-panel rounded-md px-4 py-3 text-center border-primary/20 bg-card/90 shadow-md"
        >
          <FileUp class="w-8 h-8 text-primary mx-auto mb-2" />
          <p class="ui-kicker text-primary">Drop PDFs to Import</p>
          <p class="ui-caption mt-1 text-muted-foreground/80">Add files to the registry</p>
        </div>
      </div>
      <!-- Content -->
      <ScrollArea class="flex-1 bg-sidebar">
        <div class="p-3 space-y-3">
          <div v-for="file in files" :key="file.id" class="group relative select-none">
            <div
              class="ui-panel flex items-stretch min-h-14 rounded-md overflow-hidden bg-card/80 border-border/70 shadow-sm transition-all duration-200 group-hover:border-primary/30 group-hover:bg-card group-hover:shadow-md cursor-grab active:cursor-grabbing"
              draggable="true"
              @dragstart="handleDragStart($event, file.id)"
              @click="toggleSource(file.id)"
            >
              <!-- Color Indicator -->
              <div
                class="w-1.5 shrink-0"
                :style="{ backgroundColor: document.getSourceColor(file.id) }"
              ></div>

              <div class="flex-1 flex flex-col min-w-0 p-2.5 justify-center">
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      class="flex items-center gap-2 min-w-0 text-left group/button"
                      :aria-expanded="isSourceExpanded(file.id)"
                      :aria-controls="`source-pages-${file.id}`"
                      @click.stop="toggleSource(file.id)"
                    >
                      <ChevronRight
                        class="w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 group-hover/button:text-foreground"
                        :class="isSourceExpanded(file.id) ? 'rotate-90' : ''"
                      />
                      <span class="ui-label truncate leading-tight flex-1">
                        {{ file.filename }}
                      </span>
                    </button>

                    <div
                      class="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    >
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                            @click="handleRemove(file.id, $event)"
                            aria-label="Remove source file"
                          >
                            <X class="w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Remove Source</TooltipContent>
                      </Tooltip>
                      <GripVertical class="w-3 h-3 text-muted-foreground/60" />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <div
                      class="flex items-center gap-1 px-1.5 py-0.5 bg-muted/30 rounded-sm border border-border/70"
                    >
                      <span class="ui-mono ui-2xs font-semibold text-muted-foreground uppercase"
                        >PDF</span
                      >
                      <span class="text-xs text-muted-foreground/50">/</span>
                      <span class="ui-mono text-xs text-muted-foreground">
                        {{ file.pageCount }}p
                      </span>
                    </div>
                    <span class="ui-mono text-xs text-muted-foreground">
                      {{ formatBytes(file.fileSize) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="isSourceExpanded(file.id)"
              :id="`source-pages-${file.id}`"
              class="mt-2 ml-1 mr-1 pl-3 border-l border-border/50 space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="ui-caption text-muted-foreground/70">Pages</span>
                <span class="ui-mono text-xs text-muted-foreground/70">
                  {{ file.pageCount }} total
                </span>
              </div>
              <div class="ui-caption text-muted-foreground/60">
                Select pages (Ctrl/Cmd for multi, Shift for range) and drag to append.
              </div>
              <SourcePageGrid
                :source-id="file.id"
                :page-count="file.pageCount"
                :source-color="document.getSourceColor(file.id)"
                :tile-width="84"
              />
            </div>
          </div>

          <!-- Empty State -->
          <Empty
            v-if="files.length === 0"
            class="ui-panel-muted border-dashed rounded-md p-6 text-center mt-2 bg-muted/20 group/empty transition-colors hover:border-primary/30"
          >
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                class="w-10 h-10 rounded-md bg-muted/10 flex items-center justify-center mx-auto mb-3 group-hover/empty:bg-primary/5 transition-colors"
              >
                <FileUp
                  class="w-5 h-5 text-muted-foreground/50 group-hover/empty:text-primary/50"
                />
              </EmptyMedia>
              <EmptyTitle class="ui-label text-muted-foreground">No files imported</EmptyTitle>
              <EmptyDescription class="ui-caption opacity-60"
                >Drop PDFs here to start</EmptyDescription
              >
            </EmptyHeader>
          </Empty>
        </div>
      </ScrollArea>
    </aside>
  </ResizablePanel>
</template>

