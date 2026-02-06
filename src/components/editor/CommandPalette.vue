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
import { useThemeToggle } from '@/composables/useThemeToggle'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useDocumentStore } from '@/stores/document'

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

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  action: [action: UserAction]
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()

const { mode, toggleTheme } = useThemeToggle()
const isDark = computed(() => mode.value === 'dark')

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
    id: 'clear-project',
    label: 'Clear Project',
    shortcut: '',
    icon: RotateCcw,
    action: () => {
      emit('update:open', false)
      void actions.handleClearProject()
    },
    enabled: () => true,
    category: 'File',
    keywords: ['reset', 'wipe', 'empty', 'workspace'],
  },
  {
    id: 'delete-project',
    label: 'Delete Project',
    shortcut: '',
    icon: Trash2,
    action: () => {
      emit('update:open', false)
      void actions.handleDeleteProject()
    },
    enabled: () => true,
    category: 'File',
    keywords: ['remove', 'destroy', 'project', 'dashboard'],
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
    enabled: () => document.pageCount > 0,
    category: 'File',
  },
  {
    id: 'export-selected',
    label: 'Export selected pages',
    shortcut: '',
    icon: Download,
    action: () => emit('action', UserAction.EXPORT_SELECTED),
    enabled: () => document.selectedCount > 0,
    category: 'File',
  },

  // Edit actions
  {
    id: 'undo',
    label: 'Undo',
    shortcut: 'Cmd+Z',
    icon: Undo2,
    action: () => {
      actions.undo()
      emit('update:open', false)
    },
    enabled: () => actions.canUndo.value,
    category: 'Edit',
  },
  {
    id: 'redo',
    label: 'Redo',
    shortcut: 'Shift+Cmd+Z',
    icon: Redo2,
    action: () => {
      actions.redo()
      emit('update:open', false)
    },
    enabled: () => actions.canRedo.value,
    category: 'Edit',
  },

  // Selection actions
  {
    id: 'select-all',
    label: 'Select all pages',
    shortcut: 'Cmd+A',
    icon: CheckSquare,
    action: () => {
      actions.selectAllPages()
      emit('update:open', false)
    },
    enabled: () => document.pageCount > 0,
    category: 'Selection',
  },
  {
    id: 'clear-selection',
    label: 'Clear selection',
    shortcut: 'Esc',
    icon: XSquare,
    action: () => {
      actions.clearSelection()
      emit('update:open', false)
    },
    enabled: () => document.selectedCount > 0,
    category: 'Selection',
  },
  {
    id: 'diff-pages',
    label: 'Compare selected pages',
    shortcut: 'D',
    icon: Layers,
    action: () => emit('action', UserAction.DIFF),
    enabled: () => document.selectedCount === 2,
    category: 'Selection',
  },

  // Page actions
  {
    id: 'rotate-right',
    label: 'Rotate selected right',
    shortcut: 'R',
    icon: RotateCw,
    action: () => emit('action', UserAction.ROTATE_RIGHT),
    enabled: () => document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'rotate-left',
    label: 'Rotate selected left',
    shortcut: 'Shift+R',
    icon: RotateCcw,
    action: () => emit('action', UserAction.ROTATE_LEFT),
    enabled: () => document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'delete',
    label: 'Delete selected pages',
    shortcut: 'Del',
    icon: Trash2,
    action: () => emit('action', UserAction.DELETE),
    enabled: () => document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'duplicate',
    label: 'Duplicate selected pages',
    shortcut: 'Cmd+D',
    icon: Copy,
    action: () => emit('action', UserAction.DUPLICATE),
    enabled: () => document.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'preview',
    label: 'Preview selected page',
    shortcut: 'Space',
    icon: Eye,
    action: () => emit('action', UserAction.PREVIEW),
    enabled: () => document.selectedCount === 1,
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
