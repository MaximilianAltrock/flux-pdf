<script setup lang="ts">
import { ref, computed, watch, nextTick, type Component } from 'vue'
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
  Eye,
  Sun,
  Moon,
  FolderPlus,
  Layers,
} from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { useTheme } from '@/composables/useTheme'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { UserAction } from '@/types/actions'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  action: [action: UserAction]
}>()

const store = useDocumentStore()
const { undo, redo, canUndo, canRedo } = useCommandManager()
const { isDark, toggleTheme } = useTheme()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)

interface CommandItem {
  id: string
  label: string
  shortcut?: string
  icon: Component
  action: () => void
  enabled: () => boolean
  category: string
  keywords?: string[] // Additional search keywords
}

const allCommands = computed<CommandItem[]>(() => [
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
    enabled: () => store.pageCount > 0,
    category: 'File',
  },
  {
    id: 'export-selected',
    label: 'Export selected pages',
    shortcut: '',
    icon: Download,
    action: () => emit('action', UserAction.EXPORT_SELECTED),
    enabled: () => store.selectedCount > 0,
    category: 'File',
  },

  // Edit actions
  {
    id: 'undo',
    label: 'Undo',
    shortcut: 'Ctrl+Z',
    icon: Undo2,
    action: () => {
      undo()
      emit('close')
    },
    enabled: () => canUndo.value,
    category: 'Edit',
  },
  {
    id: 'redo',
    label: 'Redo',
    shortcut: 'Ctrl+Shift+Z',
    icon: Redo2,
    action: () => {
      redo()
      emit('close')
    },
    enabled: () => canRedo.value,
    category: 'Edit',
  },

  // Selection actions
  {
    id: 'select-all',
    label: 'Select all pages',
    shortcut: 'Ctrl+A',
    icon: CheckSquare,
    action: () => {
      store.selectAll()
      emit('close')
    },
    enabled: () => store.pageCount > 0,
    category: 'Selection',
  },
  {
    id: 'clear-selection',
    label: 'Clear selection',
    shortcut: 'Esc',
    icon: XSquare,
    action: () => {
      store.clearSelection()
      emit('close')
    },
    enabled: () => store.selectedCount > 0,
    category: 'Selection',
  },
  {
    id: 'diff-pages',
    label: 'Diff selected pages (Ghost Overlay)',
    shortcut: 'D',
    icon: Layers,
    action: () => emit('action', UserAction.DIFF),
    enabled: () => store.selectedCount === 2, // Only enabled when exactly 2 selected
    category: 'Selection',
  },

  // Page actions
  {
    id: 'rotate-right',
    label: 'Rotate selected right',
    shortcut: 'R',
    icon: RotateCw,
    action: () => emit('action', UserAction.ROTATE_RIGHT),
    enabled: () => store.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'rotate-left',
    label: 'Rotate selected left',
    shortcut: 'Shift+R',
    icon: RotateCcw,
    action: () => emit('action', UserAction.ROTATE_LEFT),
    enabled: () => store.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'delete',
    label: 'Delete selected pages',
    shortcut: 'Del',
    icon: Trash2,
    action: () => emit('action', UserAction.DELETE),
    enabled: () => store.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'duplicate',
    label: 'Duplicate selected pages',
    shortcut: 'Ctrl/Cmd+D',
    icon: Copy,
    action: () => emit('action', UserAction.DUPLICATE),
    enabled: () => store.selectedCount > 0,
    category: 'Page',
  },
  {
    id: 'preview',
    label: 'Preview selected page',
    shortcut: 'Space',
    icon: Eye,
    action: () => emit('action', UserAction.PREVIEW),
    enabled: () => store.selectedCount === 1,
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
      emit('close')
    },
    enabled: () => true,
    category: 'Settings',
  },
])

const filteredCommands = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()

  if (!query) {
    return allCommands.value.filter((cmd) => cmd.enabled())
  }

  return allCommands.value.filter((cmd) => {
    if (!cmd.enabled()) return false

    const labelMatch = cmd.label.toLowerCase().includes(query)
    const categoryMatch = cmd.category.toLowerCase().includes(query)
    const shortcutMatch = cmd.shortcut?.toLowerCase().includes(query)
    const keywordMatch = cmd.keywords?.some((kw) => kw.toLowerCase().includes(query))

    return labelMatch || categoryMatch || shortcutMatch || keywordMatch
  })
})

const lastUsedIds = ref<string[]>([])

function handleCommandClick(cmd: CommandItem) {
  // Move to top of recent
  lastUsedIds.value = [cmd.id, ...lastUsedIds.value.filter((id) => id !== cmd.id)].slice(0, 3)
  cmd.action()
}

// Group commands by category
const groupedCommands = computed(() => {
  const groups: Record<string, CommandItem[]> = {}

  const query = searchQuery.value.toLowerCase().trim()

  // 1. Last Used (only if no search query)
  if (!query && lastUsedIds.value.length > 0) {
    const recent = lastUsedIds.value
      .map((id) => allCommands.value.find((c) => c.id === id))
      .filter((c): c is CommandItem => !!c && c.enabled())

    if (recent.length > 0) {
      groups['Last Used'] = recent
    }
  }

  // 2. All other commands
  for (const cmd of filteredCommands.value) {
    // Skip if in Last Used (optional, but duplicate items might be confusing. Spec usually duplicates or separates. Let's keep them in categories too for discoverability)
    if (!groups[cmd.category]) {
      groups[cmd.category] = []
    }
    groups[cmd.category]?.push(cmd)
  }

  return groups
})

// Reset selection when search changes
watch(searchQuery, () => {
  selectedIndex.value = 0
})

// Focus input when opened
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      searchQuery.value = ''
      selectedIndex.value = 0
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

useFocusTrap(
  computed(() => props.open),
  dialogRef,
  {
    onEscape: () => emit('close'),
    initialFocus: () => inputRef.value,
  },
)

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, filteredCommands.value.length - 1)
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
        @click.self="emit('close')"
        @keydown="handleKeydown"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

        <!-- Palette -->
        <div
          ref="dialogRef"
          class="relative w-full max-w-[600px] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <h2 id="command-palette-title" class="sr-only">Command palette</h2>
          <!-- Search input -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <Search class="w-5 h-5 text-text-muted/50" />
            <input
              ref="inputRef"
              v-model="searchQuery"
              type="text"
              aria-label="Search commands"
              placeholder="Type a command or search..."
              class="flex-1 text-sm outline-none placeholder-text-muted/50 bg-transparent text-text h-6"
            />
            <kbd
              class="px-1.5 py-0.5 text-[10px] uppercase font-bold text-text-muted bg-surface border border-border rounded shadow-sm"
            >
              esc
            </kbd>
          </div>

          <!-- Command list -->
          <div class="flex-1 overflow-y-auto custom-scrollbar p-2">
            <div
              v-if="Object.keys(groupedCommands).length === 0"
              class="px-4 py-12 text-center text-text-muted text-sm"
            >
              No commands found
            </div>

            <template v-else>
              <div
                v-for="(commands, category) in groupedCommands"
                :key="category"
                class="mb-2 last:mb-0"
              >
                <!-- Category header -->
                <div
                  class="px-3 py-1.5 text-[10px] uppercase font-bold text-text-muted/70 tracking-wider"
                >
                  {{ category }}
                </div>

                <!-- Commands -->
                <button
                  v-for="(cmd, idx) in commands"
                  :key="cmd.id"
                  class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all duration-75 group relative"
                  :class="
                    getGlobalIndex(category, idx) === selectedIndex
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text hover:bg-surface'
                  "
                  @click="handleCommandClick(cmd)"
                  @mouseenter="selectedIndex = getGlobalIndex(category, idx)"
                >
                  <component
                    :is="cmd.icon"
                    class="w-4 h-4 shrink-0 transition-colors"
                    :class="
                      getGlobalIndex(category, idx) === selectedIndex
                        ? 'text-white'
                        : 'text-text-muted group-hover:text-text'
                    "
                  />

                  <span class="flex-1 text-sm font-medium truncate">{{ cmd.label }}</span>

                  <span
                    v-if="cmd.shortcut"
                    class="text-[10px] font-mono opacity-60 flex items-center gap-1"
                    :class="
                      getGlobalIndex(category, idx) === selectedIndex
                        ? 'text-white'
                        : 'text-text-muted'
                    "
                  >
                    {{ cmd.shortcut }}
                  </span>
                </button>
              </div>
            </template>
          </div>

          <!-- Footer hint -->
          <div class="px-4 py-2 border-t border-border bg-surface/30 shrink-0">
            <div class="flex items-center justify-between text-[10px] text-text-muted">
              <span><strong>FluxPDF</strong> Command Palette</span>
              <div class="flex gap-3">
                <span><kbd class="font-sans">↑↓</kbd> to navigate</span>
                <span><kbd class="font-sans">↵</kbd> to run</span>
              </div>
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
