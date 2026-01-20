<script setup lang="ts">
import { computed } from 'vue'
import { Menu, X, Undo2, Redo2, ArrowLeft, CheckSquare } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { Button } from '@/components/ui/button'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  menu: []
  editTitle: []
}>()

const { haptic } = useMobile()

// Mode helpers
const mode = computed(() => props.state.mobileMode.value)
const isBrowse = computed(() => mode.value === 'browse')
const isSelect = computed(() => mode.value === 'select')
const isMove = computed(() => mode.value === 'move')

const selectedCount = computed(() => props.state.document.selectedCount)
const displayTitle = computed(() => props.state.document.projectTitle || 'Untitled')
const hasPages = computed(() => props.state.document.pageCount > 0)

// === Handlers ===

function handleMenuTap() {
  haptic('light')
  emit('menu')
}

function handleTitleTap() {
  haptic('light')
  emit('editTitle')
}

function handleEnterSelect() {
  haptic('medium')
  props.actions.enterMobileSelectionMode()
}

function handleExitSelect() {
  haptic('light')
  props.actions.exitMobileSelectionMode()
}

function handleCancelMove() {
  haptic('light')
  props.actions.exitMobileMoveMode()
}

function handleUndo() {
  if (!props.actions.canUndo.value) return
  haptic('light')
  props.actions.undo()
}

function handleRedo() {
  if (!props.actions.canRedo.value) return
  haptic('light')
  props.actions.redo()
}
</script>

<template>
  <header
    class="h-14 shrink-0 flex items-center justify-between px-4 border-b transition-colors duration-200"
    :class="{
      'bg-primary border-primary': isSelect,
      'bg-destructive/90 border-destructive': isMove,
      'bg-card border-border': isBrowse,
    }"
  >
    <!-- Left: Context-aware navigation -->
    <div class="flex items-center -ml-2 min-w-[72px]">
      <!-- Move Mode: Back/Cancel -->
      <Button
        v-if="isMove"
        variant="ghost"
        class="h-10 px-3 gap-1.5 text-destructive-foreground active:opacity-70"
        @click="handleCancelMove"
      >
        <ArrowLeft class="w-4 h-4" />
        <span class="text-sm font-medium">Cancel</span>
      </Button>

      <!-- Select Mode: Cancel (X) -->
      <Button
        v-else-if="isSelect"
        variant="ghost"
        class="h-10 px-3 gap-1.5 text-primary-foreground active:opacity-70"
        @click="handleExitSelect"
      >
        <X class="w-4 h-4" />
        <span class="text-sm font-medium">Cancel</span>
      </Button>

      <!-- Browse Mode: Menu -->
      <Button
        v-else
        variant="ghost"
        size="icon"
        class="h-10 w-10 text-foreground active:opacity-70"
        @click="handleMenuTap"
      >
        <Menu class="w-5 h-5" />
      </Button>
    </div>

    <!-- Center: Title or Status -->
    <div class="flex-1 flex justify-center min-w-0 px-2">
      <!-- Move Mode: Moving X pages -->
      <span v-if="isMove" class="text-destructive-foreground font-semibold text-sm">
        Moving {{ selectedCount }} page{{ selectedCount > 1 ? 's' : '' }}
      </span>

      <!-- Select Mode: X selected -->
      <span v-else-if="isSelect" class="text-primary-foreground font-semibold text-sm">
        {{ selectedCount }} selected
      </span>

      <!-- Browse Mode: Title -->
      <Button
        v-else
        variant="ghost"
        class="text-foreground font-semibold truncate max-w-[180px] px-2 py-1 rounded-md active:bg-muted/20 transition-colors h-auto text-sm"
        @click="handleTitleTap"
      >
        {{ displayTitle }}
      </Button>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center -mr-2 min-w-[72px] justify-end">
      <!-- Move Mode: Done (just exit, move is completed by tap) -->
      <!-- No button needed, just shows status -->
      <template v-if="isMove" />

      <!-- Select Mode: Done -->
      <Button
        v-else-if="isSelect"
        variant="ghost"
        class="h-10 px-3 text-primary-foreground font-semibold active:opacity-70"
        @click="handleExitSelect"
      >
        Done
      </Button>

      <!-- Browse Mode: Select button + Undo/Redo -->
      <template v-else>
        <Button
          v-if="hasPages"
          variant="ghost"
          size="icon"
          class="h-10 w-10 text-muted-foreground active:text-foreground"
          @click="handleEnterSelect"
        >
          <CheckSquare class="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-10 w-10 text-muted-foreground"
          :class="props.actions.canUndo.value ? '' : 'opacity-40'"
          :disabled="!props.actions.canUndo.value"
          @click="handleUndo"
        >
          <Undo2 class="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-10 w-10 text-muted-foreground"
          :class="props.actions.canRedo.value ? '' : 'opacity-40'"
          :disabled="!props.actions.canRedo.value"
          @click="handleRedo"
        >
          <Redo2 class="w-5 h-5" />
        </Button>
      </template>
    </div>
  </header>
</template>
