<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import { FileText, Layers, Upload } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { useFileInput } from '@/composables/useFileInput'

const emit = defineEmits<{
  filesSelected: [files: FileList]
  sourceDropped: [sourceId: string]
  sourcePageDropped: [sourceId: string, pageIndex: number]
  sourcePagesDropped: [pages: { sourceId: string; pageIndex: number }[]]
}>()

const isDragging = shallowRef(false)
const dragType = shallowRef<'files' | 'source' | 'page' | 'pages' | null>(null)
let dragCounter = 0

// Computed for dynamic messaging
const dropMessage = computed(() => {
  if (dragType.value === 'pages') return 'Drop to add selected pages'
  if (dragType.value === 'page') return 'Drop to add page'
  if (dragType.value === 'source') return 'Drop to add pages'
  return 'Drop PDF or images here'
})

const dropIcon = computed(() => {
  if (dragType.value === 'pages') return Layers
  if (dragType.value === 'page') return FileText
  if (dragType.value === 'source') return Layers
  return Upload
})

function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  dragCounter += 1
  if (dragCounter === 1) {
    isDragging.value = true
  }

  const types = event.dataTransfer?.types ?? []
  if (types.includes('application/x-flux-source-pages')) {
    dragType.value = 'pages'
  } else if (types.includes('application/x-flux-source-page')) {
    dragType.value = 'page'
  } else if (types.includes('application/x-flux-source-file') || types.includes('application/json')) {
    dragType.value = 'source'
  } else {
    dragType.value = 'files'
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()

  // Detect drag type
  const types = event.dataTransfer?.types ?? []
  if (types.includes('application/x-flux-source-pages')) {
    dragType.value = 'pages'
  } else if (types.includes('application/x-flux-source-page')) {
    dragType.value = 'page'
  } else if (types.includes('application/x-flux-source-file') || types.includes('application/json')) {
    dragType.value = 'source'
  } else {
    dragType.value = 'files'
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  dragCounter = Math.max(0, dragCounter - 1)
  if (dragCounter === 0) {
    isDragging.value = false
    dragType.value = null
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  dragCounter = 0
  isDragging.value = false
  dragType.value = null

  // 1. Check for internal SourceRail drag first
  const jsonData = event.dataTransfer?.getData('application/json')
  if (jsonData) {
    try {
      const data = JSON.parse(jsonData)
      if (data.type === 'source-file' && data.sourceId) {
        emit('sourceDropped', data.sourceId)
        return
      }
      if (
        data.type === 'source-pages' &&
        data.sourceId &&
        Array.isArray(data.pages)
      ) {
        const pages = data.pages
          .filter((pageIndex: unknown) => Number.isInteger(pageIndex))
          .map((pageIndex: number) => ({ sourceId: data.sourceId, pageIndex }))
        if (pages.length > 0) {
          emit('sourcePagesDropped', pages)
          return
        }
      }
      if (
        data.type === 'source-page' &&
        data.sourceId &&
        Number.isInteger(data.pageIndex)
      ) {
        emit('sourcePageDropped', data.sourceId, data.pageIndex)
        return
      }
    } catch {
      /* ignore invalid json */
    }
  }

  // 2. Handle OS file drops
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    emit('filesSelected', files)
  }
}

const { openFileDialog: openFileDialogShared } = useFileInput()

function openFileDialog() {
  openFileDialogShared()
}
</script>

<template>
  <Card
    class="relative border border-dashed rounded-md p-10 text-center transition-colors duration-200 cursor-pointer shadow-none gap-4 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
    :class="
      isDragging
        ? 'border-primary bg-primary/5 scale-[1.02]'
        : 'border-border hover:border-primary/50 hover:bg-muted/5'
    "
    role="button"
    tabindex="0"
    aria-label="Upload PDF or image files"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @click="openFileDialog"
    @keydown.enter.prevent="openFileDialog"
    @keydown.space.prevent="openFileDialog"
  >
    <!-- Icon -->
    <div
      class="mx-auto w-14 h-14 rounded-md flex items-center justify-center transition-colors"
      :class="isDragging ? 'bg-primary/10 text-primary' : 'bg-muted/20 text-muted-foreground'"
    >
      <component :is="dropIcon" class="w-8 h-8" />
    </div>

    <!-- Text -->
    <h3 class="text-sm font-semibold" :class="isDragging ? 'text-primary' : 'text-foreground'">
      {{ isDragging ? dropMessage : 'Upload PDF or image files' }}
    </h3>

    <p class="ui-caption">
      {{
        isDragging && dragType === 'source'
          ? 'Release to add all pages from this source'
          : isDragging && dragType === 'pages'
            ? 'Release to add selected pages to the stage'
            : isDragging && dragType === 'page'
              ? 'Release to add this page to the stage'
              : 'Drag & drop PDF or image files here, or click to browse'
      }}
    </p>

    <!-- Supported formats hint -->
    <p v-if="!isDragging" class="ui-caption opacity-70">Supports: .pdf, .jpg, .png</p>

    <!-- Drag overlay animation -->
    <div
      v-if="isDragging"
      class="absolute inset-4 border border-primary/50 rounded-md pointer-events-none dropzone-pulse"
    />
  </Card>
</template>

<style scoped>
.dropzone-pulse {
  animation: dropzone-pulse 1s ease-in-out infinite;
}

@keyframes dropzone-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dropzone-pulse {
    animation: none;
  }
}
</style>

