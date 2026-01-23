<script setup lang="ts">
import { ref, computed } from 'vue'
import { Upload, Layers } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'

const emit = defineEmits<{
  filesSelected: [files: FileList]
  sourceDropped: [sourceId: string]
}>()

const isDragging = ref(false)
const dragType = ref<'files' | 'source' | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let dragCounter = 0

// Computed for dynamic messaging
const dropMessage = computed(() => {
  if (dragType.value === 'source') return 'Drop to add pages'
  return 'Drop PDF or images here'
})

const dropIcon = computed(() => {
  if (dragType.value === 'source') return Layers
  return Upload
})

function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  dragCounter += 1
  if (dragCounter === 1) {
    isDragging.value = true
  }

  if (event.dataTransfer?.types.includes('application/json')) {
    dragType.value = 'source'
  } else {
    dragType.value = 'files'
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()

  // Detect drag type
  if (event.dataTransfer?.types.includes('application/json')) {
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

function handleFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    emit('filesSelected', input.files)
    // Reset input so same file can be selected again
    input.value = ''
  }
}

function openFileDialog() {
  fileInput.value?.click()
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
    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="application/pdf,.pdf,image/jpeg,image/png"
      multiple
      class="hidden"
      @change="handleFileInputChange"
    />

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

