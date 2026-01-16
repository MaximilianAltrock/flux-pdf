<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import {
  RotateCw,
  RotateCcw,
  Trash2,
  Download,
  FilePlus,
  CheckSquare,
  XSquare,
  Undo2,
  Redo2,
  Copy,
  Eye,
  Sun,
  Moon,
  FolderPlus,
  Layers,
} from 'lucide-vue-next'
import { UserAction } from '@/types/actions'
import { useColorMode } from '@vueuse/core'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'

const props = defineProps<{
  open: boolean
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  action: [action: UserAction]
}>()

const mode = useColorMode()

const isDark = computed(() => mode.value === 'dark')
const toggleTheme = () => {
  mode.value = mode.value === 'dark' ? 'light' : 'dark'
}

interface CommandItemData {
  id: string
  label: string
  shortcut?: string
  icon: Component
  action: () => void
  enabled: () => boolean
  category: string
  keywords?: string[]
}

const allCommands = computed<CommandItemData[]>(() => [
  // File actions
  {
    id: 'new-project',
    label: 'New Project',
    shortcut: '',
    icon: FolderPlus,
    action: () => emit('action', UserAction.NEW_PROJECT),
    enabled: () => true,
    category: 'File',
    keywords: ['clear', 'reset', 'workspace', 'start over'],
  },
  {
    id: 'add-files',
    label: 'Add PDF files',
    shortcut: '',
    icon: FilePlus,
    action: () => emit('action', UserAction.ADD_FILES),
    enabled: () => true,
    category: 'File',
  },
  {
    id: 'export',
    label: 'Export PDF',
    shortcut: '',
    icon: Download,
    action: () => emit('action', UserAction.EXPORT),
    enabled: () => props.state.document.pageCount > 0,
    category: 'File',
  },
  {
    id: 'export-selected',
    label: 'Export selected pages',
    shortcut: '',
    icon: Download,
    action: () => emit('action', UserAction.EXPORT_SELECTED),
    enabled: () => props.state.document.selectedCount > 0,
    category: 'File',
  },

  // Edit actions
  {
    id: 'undo',
    label: 'Undo',
    shortcut: 'Cmd+Z',
    icon: Undo2,
    action: () => {
      props.actions.undo()
      emit('update:open', false)
    },
    enabled: () => props.actions.canUndo.value,
    category: 'Edit',
  },
  {
    id: 'redo',
    label: 'Redo',
    shortcut: 'Shift+Cmd+Z',
    icon: Redo2,
    action: () => {
      props.actions.redo()
      emit('update:open', false)
    },
    enabled: () => props.actions.canRedo.value,
    category: 'Edit',
  },

  // Selection actions
  {
    id: 'select-all',
    label: 'Select all pages',
    shortcut: 'Cmd+A',
    icon: CheckSquare,
    action: () => {
      props.actions.selectAllPages()
      emit('update:open', false)
    },
    enabled: () => props.state.document.pageCount > 0,
    category: 'Selection',
  },
  {
    id: 'clear-selection',
    label: 'Clear selection',
    shortcut: 'Esc',
    icon: XSquare,
    action: () => {
      props.actions.clearSelection()
      emit('update:open', false)
    },
    enabled: () => props.state.document.selectedCount > 0,
    category: 'Selection',
  },
  {
    id: 'diff-pages',
    label: 'Diff selected pages (Ghost Overlay)',
    shortcut: 'D',
    icon: Layers,
    action: () => emit('action', UserAction.DIFF),
    enabled: () => props.state.document.selectedCount === 2,
    category: 'Selection',
  },

  // Page actions
  {
    id: 'rotate-right',
    label: 'Rotate selected right',
    shortcut: 'R',
    icon: RotateCw,
    action: () => emit('action', UserAction.ROTATE_RIGHT),
    enabled: () => props.state.document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'rotate-left',
    label: 'Rotate selected left',
    shortcut: 'Shift+R',
    icon: RotateCcw,
    action: () => emit('action', UserAction.ROTATE_LEFT),
    enabled: () => props.state.document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'delete',
    label: 'Delete selected pages',
    shortcut: 'Del',
    icon: Trash2,
    action: () => emit('action', UserAction.DELETE),
    enabled: () => props.state.document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'duplicate',
    label: 'Duplicate selected pages',
    shortcut: 'Cmd+D',
    icon: Copy,
    action: () => emit('action', UserAction.DUPLICATE),
    enabled: () => props.state.document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'preview',
    label: 'Preview selected page',
    shortcut: 'Space',
    icon: Eye,
    action: () => emit('action', UserAction.PREVIEW),
    enabled: () => props.state.document.selectedCount === 1,
    category: 'Page',
  },

  // Settings
  {
    id: 'toggle-theme',
    label: isDark.value ? 'Switch to Light Mode' : 'Switch to Dark Mode',
    shortcut: '',
    icon: isDark.value ? Sun : Moon,
    action: () => {
      toggleTheme()
      emit('update:open', false)
    },
    enabled: () => true,
    category: 'Settings',
  },
])

const lastUsedIds = ref<string[]>([])

function handleCommandSelect(cmd: CommandItemData) {
  lastUsedIds.value = [cmd.id, ...lastUsedIds.value.filter((id) => id !== cmd.id)].slice(0, 3)
  cmd.action()
}

// Group commands by category (for rendering)
const categories = computed(() => {
  const cats = new Set(allCommands.value.map((c) => c.category))
  return Array.from(cats)
})

const recentCommands = computed(() => {
  return lastUsedIds.value
    .map((id) => allCommands.value.find((c) => c.id === id))
    .filter((c): c is CommandItemData => !!c && c.enabled())
})
</script>

<template>
  <CommandDialog :open="open" :show-close-button="false" @update:open="(val) => emit('update:open', val)">
    <CommandInput placeholder="Type a command or search..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>

      <CommandGroup v-if="recentCommands.length > 0" heading="Recent">
        <CommandItem
          v-for="cmd in recentCommands"
          :key="`recent-${cmd.id}`"
          :value="cmd.label"
          @select="handleCommandSelect(cmd)"
        >
          <component :is="cmd.icon" class="mr-2 h-4 w-4" />
          <span>{{ cmd.label }}</span>
          <CommandShortcut v-if="cmd.shortcut">
            <Kbd>{{ cmd.shortcut }}</Kbd>
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>

      <CommandGroup v-for="category in categories" :key="category" :heading="category">
        <CommandItem
          v-for="cmd in allCommands.filter((c) => c.category === category && c.enabled())"
          :key="cmd.id"
          :value="cmd.label"
          @select="handleCommandSelect(cmd)"
        >
          <component :is="cmd.icon" class="mr-2 h-4 w-4" />
          <span>{{ cmd.label }}</span>
          <CommandShortcut v-if="cmd.shortcut">
            <Kbd>{{ cmd.shortcut }}</Kbd>
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
