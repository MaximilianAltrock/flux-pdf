<script setup lang="ts">
import { ref } from 'vue'
import { Upload, FileText } from 'lucide-vue-next'

const emit = defineEmits<{
  filesSelected: [files: FileList]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false

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
  <div
    class="relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer"
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
      :class="isDragging ? 'bg-primary/10 text-primary' : 'bg-muted/20 text-text-muted'"
    >
      <Upload v-if="isDragging" class="w-8 h-8" />
      <FileText v-else class="w-8 h-8" />
    </div>

    <!-- Text -->
    <h3 class="text-lg font-semibold mb-2" :class="isDragging ? 'text-primary' : 'text-text'">
      {{ isDragging ? 'Drop your PDF here' : 'Upload PDF files' }}
    </h3>

    <p class="text-sm text-text-muted mb-4">Drag & drop PDF files here, or click to browse</p>

    <!-- Supported formats hint -->
    <p class="text-xs text-text-muted">Supports: .pdf files</p>

    <!-- Drag overlay animation -->
    <div
      v-if="isDragging"
      class="absolute inset-4 border-2 border-primary/50 rounded-lg pointer-events-none"
      style="animation: dropzone-pulse 1s ease-in-out infinite"
    />
  </div>
</template>
