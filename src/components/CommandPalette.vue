<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Search,
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
  Eye
} from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { RotatePagesCommand } from '@/commands'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  action: [action: string]
}>()

const store = useDocumentStore()
const { execute, undo, redo, canUndo, canRedo } = useCommandManager()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface CommandItem {
  id: string
  label: string
  shortcut?: string
  icon: any
  action: () => void
  enabled: () => boolean
  category: string
}

const allCommands: CommandItem[] = [
  // File actions
  {
    id: 'add-files',
    label: 'Add PDF files',
    shortcut: '',
    icon: FilePlus,
    action: () => emit('action', 'add-files'),
    enabled: () => true,
    category: 'File'
  },
  {
    id: 'export',
    label: 'Export PDF',
    shortcut: '',
    icon: Download,
    action: () => emit('action', 'export'),
    enabled: () => store.pageCount > 0,
    category: 'File'
  },
  {
    id: 'export-selected',
    label: 'Export selected pages',
    shortcut: '',
    icon: Download,
    action: () => emit('action', 'export-selected'),
    enabled: () => store.selectedCount > 0,
    category: 'File'
  },

  // Edit actions
  {
    id: 'undo',
    label: 'Undo',
    shortcut: 'Ctrl+Z',
    icon: Undo2,
    action: () => { undo(); emit('close') },
    enabled: () => canUndo.value,
    category: 'Edit'
  },
  {
    id: 'redo',
    label: 'Redo',
    shortcut: 'Ctrl+Shift+Z',
    icon: Redo2,
    action: () => { redo(); emit('close') },
    enabled: () => canRedo.value,
    category: 'Edit'
  },

  // Selection actions
  {
    id: 'select-all',
    label: 'Select all pages',
    shortcut: 'Ctrl+A',
    icon: CheckSquare,
    action: () => { store.selectAll(); emit('close') },
    enabled: () => store.pageCount > 0,
    category: 'Selection'
  },
  {
    id: 'clear-selection',
    label: 'Clear selection',
    shortcut: 'Esc',
    icon: XSquare,
    action: () => { store.clearSelection(); emit('close') },
    enabled: () => store.selectedCount > 0,
    category: 'Selection'
  },

  // Page actions
  {
    id: 'rotate-right',
    label: 'Rotate selected right',
    shortcut: 'R',
    icon: RotateCw,
    action: () => {
      const ids = Array.from(store.selection.selectedIds)
      execute(new RotatePagesCommand(ids, 90))
      emit('close')
    },
    enabled: () => store.selectedCount > 0,
    category: 'Page'
  },
  {
    id: 'rotate-left',
    label: 'Rotate selected left',
    shortcut: 'Shift+R',
    icon: RotateCcw,
    action: () => {
      const ids = Array.from(store.selection.selectedIds)
      execute(new RotatePagesCommand(ids, -90))
      emit('close')
    },
    enabled: () => store.selectedCount > 0,
    category: 'Page'
  },
  {
    id: 'delete',
    label: 'Delete selected pages',
    shortcut: 'Del',
    icon: Trash2,
    action: () => {
      emit('action', 'delete')
    },
    enabled: () => store.selectedCount > 0,
    category: 'Page'
  },
  {
    id: 'duplicate',
    label: 'Duplicate selected pages',
    shortcut: 'D',
    icon: Copy,
    action: () => emit('action', 'duplicate'),
    enabled: () => store.selectedCount > 0,
    category: 'Page'
  },
  {
    id: 'preview',
    label: 'Preview selected page',
    shortcut: 'Space',
    icon: Eye,
    action: () => emit('action', 'preview'),
    enabled: () => store.selectedCount === 1,
    category: 'Page'
  }
]

const filteredCommands = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()

  if (!query) {
    return allCommands.filter(cmd => cmd.enabled())
  }

  return allCommands.filter(cmd => {
    if (!cmd.enabled()) return false

    const labelMatch = cmd.label.toLowerCase().includes(query)
    const categoryMatch = cmd.category.toLowerCase().includes(query)
    const shortcutMatch = cmd.shortcut?.toLowerCase().includes(query)

    return labelMatch || categoryMatch || shortcutMatch
  })
})

// Group commands by category
const groupedCommands = computed(() => {
  const groups: Record<string, CommandItem[]> = {}

  for (const cmd of filteredCommands.value) {
    if (!groups[cmd.category]) {
      groups[cmd.category] = []
    }
    groups[cmd.category].push(cmd)
  }

  return groups
})

// Reset selection when search changes
watch(searchQuery, () => {
  selectedIndex.value = 0
})

// Focus input when opened
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    selectedIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        filteredCommands.value.length - 1
      )
      break

    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      break

    case 'Enter':
      event.preventDefault()
      const cmd = filteredCommands.value[selectedIndex.value]
      if (cmd) {
        cmd.action()
      }
      break

    case 'Escape':
      event.preventDefault()
      emit('close')
      break
  }
}

function handleCommandClick(cmd: CommandItem) {
  cmd.action()
}

function getGlobalIndex(category: string, localIndex: number): number {
  let globalIndex = 0
  for (const [cat, cmds] of Object.entries(groupedCommands.value)) {
    if (cat === category) {
      return globalIndex + localIndex
    }
    globalIndex += cmds.length
  }
  return 0
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        @click.self="emit('close')"
        @keydown="handleKeydown"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <!-- Palette -->
        <div class="relative w-full max-w-lg bg-surface rounded-xl shadow-2xl overflow-hidden">
          <!-- Search input -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search class="w-5 h-5 text-text-muted/50" />
            <input
              ref="inputRef"
              v-model="searchQuery"
              type="text"
              placeholder="Type a command or search..."
              class="flex-1 text-sm outline-none placeholder-text-muted/50 bg-transparent text-text"
            />
            <kbd class="px-2 py-0.5 text-xs text-text-muted bg-muted/20 rounded">
              esc
            </kbd>
          </div>

          <!-- Command list -->
          <div class="max-h-80 overflow-y-auto">
            <div v-if="filteredCommands.length === 0" class="px-4 py-8 text-center text-text-muted">
              No commands found
            </div>

            <template v-else>
              <div
                v-for="(commands, category) in groupedCommands"
                :key="category"
              >
                <!-- Category header -->
                <div class="px-4 py-2 text-xs font-medium text-text-muted bg-muted/10">
                  {{ category }}
                </div>

                <!-- Commands -->
                <button
                  v-for="(cmd, idx) in commands"
                  :key="cmd.id"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  :class="getGlobalIndex(category, idx) === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/10 text-text'"
                  @click="handleCommandClick(cmd)"
                  @mouseenter="selectedIndex = getGlobalIndex(category, idx)"
                >
                  <component
                    :is="cmd.icon"
                    class="w-4 h-4"
                    :class="getGlobalIndex(category, idx) === selectedIndex
                      ? 'text-primary'
                      : 'text-text-muted'"
                  />
                  <span class="flex-1 text-sm">{{ cmd.label }}</span>
                  <kbd
                    v-if="cmd.shortcut"
                    class="px-1.5 py-0.5 text-xs rounded"
                    :class="getGlobalIndex(category, idx) === selectedIndex
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted/20 text-text-muted'"
                  >
                    {{ cmd.shortcut }}
                  </kbd>
                </button>
              </div>
            </template>
          </div>

          <!-- Footer hint -->
          <div class="px-4 py-2 border-t border-border bg-muted/5">
            <div class="flex items-center justify-center gap-4 text-xs text-text-muted/50">
              <span><kbd class="px-1 bg-muted/20 rounded">↑↓</kbd> navigate</span>
              <span><kbd class="px-1 bg-muted/20 rounded">↵</kbd> select</span>
              <span><kbd class="px-1 bg-muted/20 rounded">esc</kbd> close</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(-10px);
}
</style>
