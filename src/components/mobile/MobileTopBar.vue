<script setup lang="ts">
import { computed } from 'vue'
import { Menu, X, Undo2, Redo2, ArrowLeft } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { Button } from '@/components/ui/button'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useUiStore } from '@/stores/ui'
import { useDocumentStore } from '@/stores/document'

const actions = useDocumentActionsContext()
const ui = useUiStore()
const document = useDocumentStore()

const emit = defineEmits<{
  menu: []
  editTitle: []
}>()

const { haptic } = useMobile()

// Mode helpers
const mode = computed(() => ui.mobileMode)
const isSplit = computed(() => ui.currentTool === 'razor')
const isBrowse = computed(() => mode.value === 'browse' && !isSplit.value)
const isSelect = computed(() => mode.value === 'select')
const isMove = computed(() => mode.value === 'move')

const selectedCount = computed(() => document.selectedCount)
const displayTitle = computed(() => document.projectTitle || 'Untitled')
const hasPages = computed(() => document.pageCount > 0)
const pageCount = computed(() => document.pageCount)
const isAllSelected = computed(
  () => pageCount.value > 0 && selectedCount.value === pageCount.value,
)
const canUndo = computed(() => actions.canUndo.value)
const canRedo = computed(() => actions.canRedo.value)
const showUndo = computed(() => isBrowse.value)
const showRedo = computed(() => isBrowse.value)

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
  actions.enterMobileSelectionMode()
}

function handleExitSelect() {
  haptic('light')
  actions.exitMobileSelectionMode()
}

function handleSelectAll() {
  actions.selectAllPages()
}

function handleDeselectAll() {
  actions.clearSelectionKeepMode()
}

function handleCancelMove() {
  haptic('light')
  actions.exitMobileMoveMode()
}

function handleExitSplit() {
  haptic('light')
  actions.exitMobileSplitMode()
}

function handleUndo() {
  if (!canUndo.value) return
  haptic('light')
  actions.undo()
}

function handleRedo() {
  if (!canRedo.value) return
  haptic('light')
  actions.redo()
}
</script>

<template>
  <header
    class="h-14 shrink-0 flex items-center justify-between px-4 border-b transition-colors duration-200"
    :class="{
      'bg-primary border-primary': isSelect,
      'bg-accent border-accent': isMove || isSplit,
      'bg-card border-border': isBrowse,
    }"
  >
    <!-- Left: Context-aware navigation -->
    <div class="flex items-center -ml-2 min-w-[72px]">
      <!-- Split Mode: Cancel -->
      <Button
        v-if="isSplit"
        variant="ghost"
        class="h-11 px-3 gap-1.5 text-accent-foreground active:opacity-70"
        @click="handleExitSplit"
      >
        <ArrowLeft class="w-4 h-4" />
        <span class="text-sm font-medium">Done</span>
      </Button>

      <!-- Move Mode: Back/Cancel -->
      <Button
        v-else-if="isMove"
        variant="ghost"
        class="h-11 px-3 gap-1.5 text-accent-foreground active:opacity-70"
        @click="handleCancelMove"
      >
        <ArrowLeft class="w-4 h-4" />
        <span class="text-sm font-medium">Cancel</span>
      </Button>

      <!-- Select Mode: Cancel (X) -->
      <Button
        v-else-if="isSelect"
        variant="ghost"
        class="h-11 px-3 gap-1.5 text-primary-foreground active:opacity-70"
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
        class="h-11 w-11 text-foreground active:opacity-70"
        @click="handleMenuTap"
        aria-label="Open menu"
      >
        <Menu class="w-5 h-5" />
      </Button>
    </div>

    <!-- Center: Title or Status -->
    <div class="flex-1 flex justify-center min-w-0 px-2">
      <!-- Split Mode -->
      <span v-if="isSplit" class="text-accent-foreground font-semibold text-sm">
        Split mode
      </span>

      <!-- Move Mode: Moving X pages -->
      <span v-else-if="isMove" class="text-accent-foreground font-semibold text-sm">
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
      <!-- Move/Split Mode: no right actions -->
      <template v-if="isMove || isSplit" />

      <!-- Select Mode: Done -->
      <Button
        v-else-if="isSelect"
        variant="ghost"
        class="h-11 px-3 min-w-[96px] text-primary-foreground font-semibold active:opacity-70"
        :disabled="!hasPages"
        @click="isAllSelected ? handleDeselectAll() : handleSelectAll()"
      >
        {{ isAllSelected ? 'Deselect' : 'Select All' }}
      </Button>

      <!-- Browse Mode: Select + Undo -->
      <template v-else>
        <Button
          v-if="hasPages"
          variant="ghost"
          class="h-11 px-3 text-foreground font-semibold active:opacity-70"
          @click="handleEnterSelect"
        >
          Select
        </Button>

        <Button
          v-if="showUndo"
          variant="ghost"
          size="icon"
          class="h-11 w-11 text-muted-foreground active:text-foreground"
          :class="canUndo ? '' : 'opacity-40'"
          :disabled="!canUndo"
          @click="handleUndo"
          aria-label="Undo"
        >
          <Undo2 class="w-5 h-5" />
        </Button>

        <Button
          v-if="showRedo"
          variant="ghost"
          size="icon"
          class="h-11 w-11 text-muted-foreground active:text-foreground"
          :class="canRedo ? '' : 'opacity-40'"
          :disabled="!canRedo"
          @click="handleRedo"
          aria-label="Redo"
        >
          <Redo2 class="w-5 h-5" />
        </Button>
      </template>
    </div>
  </header>
</template>
