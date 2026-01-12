<script setup lang="ts">
import { computed } from 'vue'
import {
  FilePlus,
  Trash2,
  RotateCw,
  RotateCcw,
  Download,
  CheckSquare,
  XSquare,
  Undo2,
  Redo2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

defineOptions({ name: 'AppToolbar' })

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  addFiles: []
  export: []
  exportSelected: []
  deleteSelected: []
}>()

const hasSelection = computed(() => props.state.document.selectedCount > 0)
const hasPages = computed(() => props.state.document.pageCount > 0)

function handleDeleteSelected() {
  emit('deleteSelected')
}

function rotateSelected(direction: 'cw' | 'ccw') {
  const degrees = direction === 'cw' ? 90 : -90
  if (props.state.document.selectedCount === 0) return
  props.actions.handleRotateSelected(degrees)
}

function selectAll() {
  props.actions.selectAllPages()
}

function clearSelection() {
  props.actions.clearSelection()
}
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <div
      class="flex items-center gap-2 px-4 py-2 bg-background border-b border-border shadow-sm z-10 relative"
    >
      <!-- Add files button -->
      <Button variant="default" size="sm" class="gap-2" @click="emit('addFiles')">
        <FilePlus class="w-4 h-4" />
        <span class="hidden sm:inline">Add PDF</span>
      </Button>

      <Separator orientation="vertical" class="h-6 mx-1" />

      <!-- Undo/Redo -->
      <ButtonGroup class="gap-1 [&_[data-slot=button]]:rounded-md">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="!props.actions.canUndo.value"
              @click="props.actions.undo"
            >
              <Undo2 class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="flex items-center gap-2">
            <span v-if="props.actions.undoName.value"
              >Undo: {{ props.actions.undoName.value }}</span
            >
            <span v-else>Nothing to undo</span>
            <Kbd>⌘Z</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="!props.actions.canRedo.value"
              @click="props.actions.redo"
            >
              <Redo2 class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="flex items-center gap-2">
            <span v-if="props.actions.redoName.value"
              >Redo: {{ props.actions.redoName.value }}</span
            >
            <span v-else>Nothing to redo</span>
            <Kbd>⇧⌘Z</Kbd>
          </TooltipContent>
        </Tooltip>
      </ButtonGroup>

      <Separator orientation="vertical" class="h-6 mx-1" />

      <!-- Selection actions -->
      <ButtonGroup class="gap-1 [&_[data-slot=button]]:rounded-md">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon-sm" :disabled="!hasPages" @click="selectAll">
              <CheckSquare class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="flex items-center gap-2">
            Select All <Kbd>⌘A</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="!hasSelection"
              @click="clearSelection"
            >
              <XSquare class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="flex items-center gap-2">
            Clear Selection <Kbd>Esc</Kbd>
          </TooltipContent>
        </Tooltip>
      </ButtonGroup>

      <Separator orientation="vertical" class="h-6 mx-1" />

      <!-- Page actions -->
      <ButtonGroup class="gap-1 [&_[data-slot=button]]:rounded-md">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="!hasSelection"
              @click="rotateSelected('ccw')"
            >
              <RotateCcw class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="flex items-center gap-2">
            Rotate Left <Kbd>⇧R</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="!hasSelection"
              @click="rotateSelected('cw')"
            >
              <RotateCw class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="flex items-center gap-2">
            Rotate Right <Kbd>R</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="hover:bg-destructive/10 hover:text-destructive"
              :disabled="!hasSelection"
              @click="handleDeleteSelected"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="flex items-center gap-2">
            Delete Selected <Kbd>Del</Kbd>
          </TooltipContent>
        </Tooltip>
      </ButtonGroup>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Selection info -->
      <div v-if="hasPages" class="text-xs text-muted-foreground mr-4 hidden md:block">
        <span v-if="hasSelection">
          {{ props.state.document.selectedCount }} of {{ props.state.document.pageCount }} selected
        </span>
        <span v-else>
          {{ props.state.document.pageCount }} page{{
            props.state.document.pageCount === 1 ? '' : 's'
          }}
        </span>
      </div>

      <!-- Export buttons -->
      <ButtonGroup class="gap-2 [&_[data-slot=button]]:rounded-md">
        <Button
          v-if="hasSelection"
          variant="outline"
          size="sm"
          class="gap-2"
          @click="emit('exportSelected')"
        >
          <Download class="w-4 h-4" />
          <span class="hidden lg:inline">Export Selected</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          class="gap-2 bg-foreground text-background hover:bg-foreground/90"
          :disabled="!hasPages"
          @click="emit('export')"
        >
          <Download class="w-4 h-4" />
          <span class="hidden sm:inline">Export PDF</span>
        </Button>
      </ButtonGroup>
    </div>
  </TooltipProvider>
</template>
