<script setup lang="ts">
import { computed } from 'vue'
import { Menu, X, Undo2, Redo2 } from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { useMobile } from '@/composables/useMobile'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  selectionMode: boolean
  selectedCount: number
}>()

const emit = defineEmits<{
  menu: []
  exitSelection: []
  editTitle: []
}>()

const store = useDocumentStore()
const { undo, redo, canUndo, canRedo } = useCommandManager()
const { haptic } = useMobile()

const displayTitle = computed(() => store.projectTitle || 'Untitled')

function handleExitSelection() {
  haptic('light')
  store.clearSelection()
  emit('exitSelection')
}

function handleTitleTap() {
  if (props.selectionMode) return
  haptic('light')
  emit('editTitle')
}

function handleUndo() {
  if (!canUndo.value) return
  haptic('light')
  undo()
}

function handleRedo() {
  if (!canRedo.value) return
  haptic('light')
  redo()
}
</script>

<template>
  <header
    class="h-14 shrink-0 flex items-center justify-between px-4 border-b transition-colors duration-200"
    :class="selectionMode ? 'bg-primary border-primary' : 'bg-card border-border'"
  >
    <!-- Left: Menu or Cancel -->
    <Button
      v-if="selectionMode"
      variant="ghost"
      class="w-10 h-10 -ml-2 flex items-center justify-center text-primary-foreground active:opacity-70 transition-opacity"
      @click="handleExitSelection"
    >
      <X class="w-5 h-5" />
    </Button>
    <Button
      v-else
      variant="ghost"
      class="w-10 h-10 -ml-2 flex items-center justify-center text-foreground active:opacity-70 transition-opacity"
      @click="emit('menu')"
    >
      <Menu class="w-5 h-5" />
    </Button>

    <!-- Center: Title or Selection Count -->
    <div class="flex-1 flex justify-center min-w-0 px-2">
      <span v-if="selectionMode" class="text-primary-foreground font-semibold">
        {{ selectedCount }} selected
      </span>
      <Button
        v-else
        variant="ghost"
        class="text-foreground font-semibold truncate max-w-[180px] px-3 py-1.5 rounded-lg active:bg-muted/10 transition-colors border border-transparent active:border-border h-auto"
        @click="handleTitleTap"
      >
        {{ displayTitle }}
      </Button>
    </div>

    <!-- Right: Undo/Redo -->
    <div class="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        class="w-10 h-10 flex items-center justify-center transition-all active:scale-90"
        :class="[
          selectionMode ? 'text-primary-foreground/80' : 'text-muted-foreground',
          canUndo ? '' : 'opacity-40',
        ]"
        :disabled="!canUndo"
        @click="handleUndo"
      >
        <Undo2 class="w-5 h-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="w-10 h-10 -mr-2 flex items-center justify-center transition-all active:scale-90"
        :class="[
          selectionMode ? 'text-primary-foreground/80' : 'text-muted-foreground',
          canRedo ? '' : 'opacity-40',
        ]"
        :disabled="!canRedo"
        @click="handleRedo"
      >
        <Redo2 class="w-5 h-5" />
      </Button>
    </div>
  </header>
</template>

