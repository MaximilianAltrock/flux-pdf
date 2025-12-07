<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { RotatePagesCommand } from '@/commands'
import {
  FilePlus,
  Trash2,
  RotateCw,
  RotateCcw,
  Download,
  CheckSquare,
  XSquare,
  Undo2,
  Redo2
} from 'lucide-vue-next'

const emit = defineEmits<{
  addFiles: []
  export: []
  exportSelected: []
  deleteSelected: []
}>()

const store = useDocumentStore()
const { execute, undo, redo, canUndo, canRedo, undoName, redoName } = useCommandManager()

const hasSelection = computed(() => store.selectedCount > 0)
const hasPages = computed(() => store.pageCount > 0)

function handleDeleteSelected() {
  emit('deleteSelected')
}

function rotateSelected(direction: 'cw' | 'ccw') {
  if (store.selectedCount === 0) return

  const selectedIds = Array.from(store.selection.selectedIds)
  const degrees = direction === 'cw' ? 90 : -90
  execute(new RotatePagesCommand(selectedIds, degrees))
}

function selectAll() {
  store.selectAll()
}

function clearSelection() {
  store.clearSelection()
}
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
    <!-- Add files button -->
    <button
      class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      title="Add PDF files"
      @click="emit('addFiles')"
    >
      <FilePlus class="w-4 h-4" />
      <span>Add PDF</span>
    </button>

    <!-- Divider -->
    <div class="w-px h-6 bg-border mx-2" />

    <!-- Undo/Redo -->
    <div class="flex items-center gap-1">
      <button
        class="p-2 rounded-lg transition-colors"
        :class="canUndo ? 'hover:bg-muted/20 text-text' : 'text-text-muted/50 cursor-not-allowed'"
        :disabled="!canUndo"
        :title="undoName ? `Undo: ${undoName} (Ctrl+Z)` : 'Nothing to undo'"
        @click="undo"
      >
        <Undo2 class="w-5 h-5" />
      </button>

      <button
        class="p-2 rounded-lg transition-colors"
        :class="canRedo ? 'hover:bg-muted/20 text-text' : 'text-text-muted/50 cursor-not-allowed'"
        :disabled="!canRedo"
        :title="redoName ? `Redo: ${redoName} (Ctrl+Shift+Z)` : 'Nothing to redo'"
        @click="redo"
      >
        <Redo2 class="w-5 h-5" />
      </button>
    </div>

    <!-- Divider -->
    <div class="w-px h-6 bg-border mx-2" />

    <!-- Selection actions -->
    <div class="flex items-center gap-1">
      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasPages ? 'hover:bg-muted/20 text-text' : 'text-text-muted/50 cursor-not-allowed'"
        :disabled="!hasPages"
        title="Select All (Ctrl+A)"
        @click="selectAll"
      >
        <CheckSquare class="w-5 h-5" />
      </button>

      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-muted/20 text-text' : 'text-text-muted/50 cursor-not-allowed'"
        :disabled="!hasSelection"
        title="Clear Selection (Esc)"
        @click="clearSelection"
      >
        <XSquare class="w-5 h-5" />
      </button>
    </div>

    <!-- Divider -->
    <div class="w-px h-6 bg-border mx-2" />

    <!-- Page actions -->
    <div class="flex items-center gap-1">
      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-muted/20 text-text' : 'text-text-muted/50 cursor-not-allowed'"
        :disabled="!hasSelection"
        title="Rotate Left (Shift+R)"
        @click="rotateSelected('ccw')"
      >
        <RotateCcw class="w-5 h-5" />
      </button>

      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-muted/20 text-text' : 'text-text-muted/50 cursor-not-allowed'"
        :disabled="!hasSelection"
        title="Rotate Right (R)"
        @click="rotateSelected('cw')"
      >
        <RotateCw class="w-5 h-5" />
      </button>

      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-danger/10 text-danger' : 'text-text-muted/50 cursor-not-allowed'"
        :disabled="!hasSelection"
        title="Delete Selected (Delete)"
        @click="handleDeleteSelected"
      >
        <Trash2 class="w-5 h-5" />
      </button>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Selection info -->
    <div v-if="hasPages" class="text-sm text-text-muted mr-4">
      <span v-if="hasSelection">
        {{ store.selectedCount }} of {{ store.pageCount }} selected
      </span>
      <span v-else>
        {{ store.pageCount }} page{{ store.pageCount === 1 ? '' : 's' }}
      </span>
    </div>

    <!-- Export buttons -->
    <div class="flex items-center gap-2">
      <!-- Export selected (only shown when there's a selection) -->
      <button
        v-if="hasSelection"
        class="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted/20 transition-colors text-text"
        title="Export only the selected pages"
        @click="emit('exportSelected')"
      >
        <Download class="w-4 h-4" />
        <span>Export Selected</span>
      </button>

      <!-- Export all -->
      <button
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
        :class="hasPages
          ? 'bg-text text-background hover:bg-text/90'
          : 'bg-muted/20 text-text-muted cursor-not-allowed'"
        :disabled="!hasPages"
        title="Export all pages as PDF"
        @click="emit('export')"
      >
        <Download class="w-4 h-4" />
        <span>Export PDF</span>
      </button>
    </div>
  </div>
</template>
