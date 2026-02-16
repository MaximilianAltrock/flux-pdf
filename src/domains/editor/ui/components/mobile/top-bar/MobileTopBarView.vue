<script setup lang="ts">
import { ArrowLeft, Menu, Redo2, Undo2, X } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'

const props = defineProps<{
  isSplit: boolean
  isMove: boolean
  isSelect: boolean
  isBrowse: boolean
  selectedCount: number
  displayTitle: string
  hasPages: boolean
  isAllSelected: boolean
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  menu: []
  editTitle: []
  enterSelect: []
  exitSelect: []
  selectAll: []
  deselectAll: []
  cancelMove: []
  exitSplit: []
  undo: []
  redo: []
}>()
</script>

<template>
  <header
    class="h-14 shrink-0 flex items-center justify-between px-4 border-b transition-colors duration-200"
    :class="{
      'bg-primary border-primary': props.isSelect,
      'bg-accent border-accent': props.isMove || props.isSplit,
      'bg-card border-border': props.isBrowse,
    }"
  >
    <div class="flex items-center -ml-2 min-w-[72px]">
      <Button
        v-if="props.isSplit"
        variant="ghost"
        class="h-11 px-3 gap-1.5 text-accent-foreground active:opacity-70"
        @click="emit('exitSplit')"
      >
        <ArrowLeft class="w-4 h-4" />
        <span class="text-sm font-medium">Done</span>
      </Button>

      <Button
        v-else-if="props.isMove"
        variant="ghost"
        class="h-11 px-3 gap-1.5 text-accent-foreground active:opacity-70"
        @click="emit('cancelMove')"
      >
        <ArrowLeft class="w-4 h-4" />
        <span class="text-sm font-medium">Cancel</span>
      </Button>

      <Button
        v-else-if="props.isSelect"
        variant="ghost"
        class="h-11 px-3 gap-1.5 text-primary-foreground active:opacity-70"
        @click="emit('exitSelect')"
      >
        <X class="w-4 h-4" />
        <span class="text-sm font-medium">Cancel</span>
      </Button>

      <Button
        v-else
        variant="ghost"
        size="icon"
        class="h-11 w-11 text-foreground active:opacity-70"
        @click="emit('menu')"
        aria-label="Open menu"
      >
        <Menu class="w-5 h-5" />
      </Button>
    </div>

    <div class="flex-1 flex justify-center min-w-0 px-2">
      <span v-if="props.isSplit" class="text-accent-foreground font-semibold text-sm">
        Split mode
      </span>

      <span v-else-if="props.isMove" class="text-accent-foreground font-semibold text-sm">
        Moving {{ props.selectedCount }} page{{ props.selectedCount > 1 ? 's' : '' }}
      </span>

      <span v-else-if="props.isSelect" class="text-primary-foreground font-semibold text-sm">
        {{ props.selectedCount }} selected
      </span>

      <Button
        v-else
        variant="ghost"
        class="text-foreground font-semibold truncate max-w-[180px] px-2 py-1 rounded-md active:bg-muted/20 transition-colors h-auto text-sm"
        @click="emit('editTitle')"
      >
        {{ props.displayTitle }}
      </Button>
    </div>

    <div class="flex items-center -mr-2 min-w-[72px] justify-end">
      <template v-if="props.isMove || props.isSplit" />

      <Button
        v-else-if="props.isSelect"
        variant="ghost"
        class="h-11 px-3 min-w-[96px] text-primary-foreground font-semibold active:opacity-70"
        :disabled="!props.hasPages"
        @click="props.isAllSelected ? emit('deselectAll') : emit('selectAll')"
      >
        {{ props.isAllSelected ? 'Deselect' : 'Select All' }}
      </Button>

      <template v-else>
        <Button
          v-if="props.hasPages"
          variant="ghost"
          class="h-11 px-3 text-foreground font-semibold active:opacity-70"
          @click="emit('enterSelect')"
        >
          Select
        </Button>

        <Button
          v-if="props.isBrowse"
          variant="ghost"
          size="icon"
          class="h-11 w-11 text-muted-foreground active:text-foreground"
          :class="props.canUndo ? '' : 'opacity-40'"
          :disabled="!props.canUndo"
          @click="emit('undo')"
          aria-label="Undo"
        >
          <Undo2 class="w-5 h-5" />
        </Button>

        <Button
          v-if="props.isBrowse"
          variant="ghost"
          size="icon"
          class="h-11 w-11 text-muted-foreground active:text-foreground"
          :class="props.canRedo ? '' : 'opacity-40'"
          :disabled="!props.canRedo"
          @click="emit('redo')"
          aria-label="Redo"
        >
          <Redo2 class="w-5 h-5" />
        </Button>
      </template>
    </div>
  </header>
</template>
