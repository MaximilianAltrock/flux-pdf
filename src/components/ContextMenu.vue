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
import { UserAction } from '@/types/actions'

const props = defineProps<{
  x: number
  y: number
  visible: boolean
  selectedCount: number
  pageNumber: number
}>()

const emit = defineEmits<{
  close: []
  action: [action: UserAction]
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

function handleAction(action: UserAction) {
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
        class="fixed z-[80] bg-surface rounded-lg shadow-xl border border-border py-1 min-w-[180px]"
        :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      >
        <!-- Header -->
        <div class="px-3 py-2 text-xs font-medium text-text-muted border-b border-border">
          {{ menuLabel }}
        </div>

        <!-- Actions -->
        <div class="py-1">
          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            @click="handleAction(UserAction.PREVIEW)"
          >
            <Eye class="w-4 h-4 text-text-muted" />
            <span>Preview</span>
            <span class="ml-auto text-xs text-text-muted">Space</span>
          </button>

          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            @click="handleAction(UserAction.DUPLICATE)"
          >
            <Copy class="w-4 h-4 text-text-muted" />
            <span>Duplicate</span>
          </button>

          <div class="my-1 border-t border-border" />

          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            @click="handleAction(UserAction.ROTATE_LEFT)"
          >
            <RotateCcw class="w-4 h-4 text-text-muted" />
            <span>Rotate Left</span>
            <span class="ml-auto text-xs text-text-muted">⇧R</span>
          </button>

          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            @click="handleAction(UserAction.ROTATE_RIGHT)"
          >
            <RotateCw class="w-4 h-4 text-text-muted" />
            <span>Rotate Right</span>
            <span class="ml-auto text-xs text-text-muted">R</span>
          </button>

          <div class="my-1 border-t border-border" />

          <button
            v-if="selectedCount > 0"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            @click="handleAction(UserAction.SELECT_ALL)"
          >
            <CheckSquare class="w-4 h-4 text-text-muted" />
            <span>Select All</span>
            <span class="ml-auto text-xs text-text-muted">⌘A</span>
          </button>

          <button
            v-if="selectedCount > 0"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            @click="handleAction(UserAction.EXPORT_SELECTED)"
          >
            <Download class="w-4 h-4 text-text-muted" />
            <span>Export Selected</span>
          </button>

          <div class="my-1 border-t border-border" />

          <button
            class="w-full flex items-center gap-3 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
            @click="handleAction(UserAction.DELETE)"
          >
            <Trash2 class="w-4 h-4" />
            <span>Delete</span>
            <span class="ml-auto text-xs text-danger/70">Del</span>
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
