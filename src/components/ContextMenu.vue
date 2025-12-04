<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  RotateCw, 
  RotateCcw, 
  Trash2, 
  Copy, 
  Eye,
  CheckSquare,
  Download
} from 'lucide-vue-next'

const props = defineProps<{
  x: number
  y: number
  visible: boolean
  selectedCount: number
  pageNumber: number
}>()

const emit = defineEmits<{
  close: []
  action: [action: string]
}>()

const menuRef = ref<HTMLElement | null>(null)

// Adjust position to keep menu in viewport
const position = computed(() => {
  let x = props.x
  let y = props.y
  
  // Approximate menu size
  const menuWidth = 200
  const menuHeight = 280
  
  // Adjust if too close to right edge
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  
  // Adjust if too close to bottom
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }
  
  return { x, y }
})

const menuLabel = computed(() => {
  if (props.selectedCount > 1) {
    return `${props.selectedCount} pages selected`
  }
  return `Page ${props.pageNumber}`
})

function handleAction(action: string) {
  emit('action', action)
  emit('close')
}

function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="fixed z-[80] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]"
        :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      >
        <!-- Header -->
        <div class="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
          {{ menuLabel }}
        </div>
        
        <!-- Actions -->
        <div class="py-1">
          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleAction('preview')"
          >
            <Eye class="w-4 h-4 text-gray-400" />
            <span>Preview</span>
            <span class="ml-auto text-xs text-gray-400">Space</span>
          </button>
          
          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleAction('duplicate')"
          >
            <Copy class="w-4 h-4 text-gray-400" />
            <span>Duplicate</span>
          </button>
          
          <div class="my-1 border-t border-gray-100 dark:border-gray-700" />
          
          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleAction('rotate-left')"
          >
            <RotateCcw class="w-4 h-4 text-gray-400" />
            <span>Rotate Left</span>
            <span class="ml-auto text-xs text-gray-400">⇧R</span>
          </button>
          
          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleAction('rotate-right')"
          >
            <RotateCw class="w-4 h-4 text-gray-400" />
            <span>Rotate Right</span>
            <span class="ml-auto text-xs text-gray-400">R</span>
          </button>
          
          <div class="my-1 border-t border-gray-100 dark:border-gray-700" />
          
          <button
            v-if="selectedCount > 0"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleAction('select-all')"
          >
            <CheckSquare class="w-4 h-4 text-gray-400" />
            <span>Select All</span>
            <span class="ml-auto text-xs text-gray-400">⌘A</span>
          </button>
          
          <button
            v-if="selectedCount > 0"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="handleAction('export-selected')"
          >
            <Download class="w-4 h-4 text-gray-400" />
            <span>Export Selected</span>
          </button>
          
          <div class="my-1 border-t border-gray-100 dark:border-gray-700" />
          
          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            @click="handleAction('delete')"
          >
            <Trash2 class="w-4 h-4" />
            <span>Delete</span>
            <span class="ml-auto text-xs text-red-400">Del</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.menu-enter-active {
  transition: all 0.15s ease-out;
}

.menu-leave-active {
  transition: all 0.1s ease-in;
}

.menu-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
