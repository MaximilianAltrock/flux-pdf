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

// Computed for dynamic messaging
const dropMessage = computed(() => {
  if (dragType.value === 'source') return 'Drop to add pages'
  return 'Drop your PDF here'
})

const dropIcon = computed(() => {
  if (dragType.value === 'source') return Layers
  return Upload
})

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true

  // Detect drag type
  if (event.dataTransfer?.types.includes('application/json')) {
    dragType.value = 'source'
  } else {
    dragType.value = 'files'
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  dragType.value = null
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
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
    class="relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer shadow-none gap-0"
    :class="
      isDragging
        ? 'border-primary bg-primary/5 scale-[1.02]'
        : 'border-border hover:border-primary/50 hover:bg-muted/5'
    "
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @click="openFileDialog"
  >
    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="application/pdf,.pdf"
      multiple
      class="hidden"
      @change="handleFileInputChange"
    />

    <!-- Icon -->
    <div
      class="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors"
      :class="isDragging ? 'bg-primary/10 text-primary' : 'bg-muted/20 text-muted-foreground'"
    >
      <component :is="dropIcon" class="w-8 h-8" />
    </div>

    <!-- Text -->
    <h3 class="text-lg font-semibold mb-2" :class="isDragging ? 'text-primary' : 'text-foreground'">
      {{ isDragging ? dropMessage : 'Upload PDF files' }}
    </h3>

    <p class="text-sm text-muted-foreground mb-4">
      {{
        isDragging && dragType === 'source'
          ? 'Release to add all pages from this source'
          : 'Drag & drop PDF files here, or click to browse'
      }}
    </p>

    <!-- Supported formats hint -->
    <p v-if="!isDragging" class="text-xs text-muted-foreground">Supports: .pdf files</p>

    <!-- Drag overlay animation -->
    <div
      v-if="isDragging"
      class="absolute inset-4 border-2 border-primary/50 rounded-lg pointer-events-none"
      style="animation: dropzone-pulse 1s ease-in-out infinite"
    />
  </Card>
</template>

<style scoped>
@keyframes dropzone-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
</style>

