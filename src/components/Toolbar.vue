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
  <div class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <!-- Add files button -->
    <button
      class="flex items-center gap-2 px-4 py-2 bg-flux-500 text-white rounded-lg hover:bg-flux-600 transition-colors"
      title="Add PDF files"
      @click="emit('addFiles')"
    >
      <FilePlus class="w-4 h-4" />
      <span>Add PDF</span>
    </button>
    
    <!-- Divider -->
    <div class="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-2" />
    
    <!-- Undo/Redo -->
    <div class="flex items-center gap-1">
      <button
        class="p-2 rounded-lg transition-colors"
        :class="canUndo ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        :disabled="!canUndo"
        :title="undoName ? `Undo: ${undoName} (Ctrl+Z)` : 'Nothing to undo'"
        @click="undo"
      >
        <Undo2 class="w-5 h-5" />
      </button>
      
      <button
        class="p-2 rounded-lg transition-colors"
        :class="canRedo ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        :disabled="!canRedo"
        :title="redoName ? `Redo: ${redoName} (Ctrl+Shift+Z)` : 'Nothing to redo'"
        @click="redo"
      >
        <Redo2 class="w-5 h-5" />
      </button>
    </div>
    
    <!-- Divider -->
    <div class="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-2" />
    
    <!-- Selection actions -->
    <div class="flex items-center gap-1">
      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasPages ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        :disabled="!hasPages"
        title="Select All (Ctrl+A)"
        @click="selectAll"
      >
        <CheckSquare class="w-5 h-5" />
      </button>
      
      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        :disabled="!hasSelection"
        title="Clear Selection (Esc)"
        @click="clearSelection"
      >
        <XSquare class="w-5 h-5" />
      </button>
    </div>
    
    <!-- Divider -->
    <div class="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-2" />
    
    <!-- Page actions -->
    <div class="flex items-center gap-1">
      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        :disabled="!hasSelection"
        title="Rotate Left (Shift+R)"
        @click="rotateSelected('ccw')"
      >
        <RotateCcw class="w-5 h-5" />
      </button>
      
      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        :disabled="!hasSelection"
        title="Rotate Right (R)"
        @click="rotateSelected('cw')"
      >
        <RotateCw class="w-5 h-5" />
      </button>
      
      <button
        class="p-2 rounded-lg transition-colors"
        :class="hasSelection ? 'hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
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
    <div v-if="hasPages" class="text-sm text-gray-500 dark:text-gray-400 mr-4">
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
        class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
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
          ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200' 
          : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'"
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
