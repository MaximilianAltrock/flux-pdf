<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Search,
  Download,
  MousePointer2,
  Scissors,
  Minus,
  Plus,
  Loader2,
  Sun,
  Moon,
  FilePlus,
  HelpCircle,
} from 'lucide-vue-next'
import { useDocumentStore } from '@/stores/document'
import { useTheme } from '@/composables/useTheme'

const store = useDocumentStore()
const { isDark, toggleTheme } = useTheme()

const isEditingTitle = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)

// Logo menu state
const showLogoMenu = ref(false)
const logoMenuRef = ref<HTMLElement | null>(null)

// Computed for Title to handle store sync and validation
const displayTitle = computed({
  get: () => store.projectTitle,
  set: (val) => {
    store.projectTitle = val
  },
})

function startEditing() {
  isEditingTitle.value = true
  setTimeout(() => titleInput.value?.focus(), 0)
}

function finishEditing() {
  isEditingTitle.value = false
  // Trim and validation rule
  let val = store.projectTitle.trim()
  if (!val) {
    val = 'Untitled Project' // Revert to default if empty
  }
  // Strip illegal chars
  val = val.replace(/[/\\:]/g, '-')
  store.projectTitle = val
}

// Logo menu handlers
function toggleLogoMenu() {
  showLogoMenu.value = !showLogoMenu.value
}

function handleNewProject() {
  showLogoMenu.value = false
  emit('new-project')
}

function handleShowHelp() {
  showLogoMenu.value = false
  emit('show-help')
}

function handleClickOutside(event: MouseEvent) {
  if (logoMenuRef.value && !logoMenuRef.value.contains(event.target as Node)) {
    showLogoMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Export logic
const canExport = computed(() => store.pageCount > 0)

const emit = defineEmits<{
  (e: 'command'): void
  (e: 'export'): void
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'new-project'): void
  (e: 'show-help'): void
}>()
</script>

<template>
  <header
    class="h-[48px] bg-surface border-b border-border flex items-center justify-between px-4 shrink-0 z-30 relative select-none"
  >
    <!-- Left: Context Zone -->
    <div class="flex items-center gap-4 w-[280px]">
      <!-- Logo with Dropdown -->
      <div ref="logoMenuRef" class="relative">
        <button
          @click.stop="toggleLogoMenu"
          class="w-6 h-6 bg-primary/20 rounded-sm flex items-center justify-center hover:bg-primary/30 transition-colors cursor-pointer"
          title="FluxPDF Menu"
        >
          <div class="w-3 h-3 bg-primary rounded-[1px]"></div>
        </button>

        <!-- Logo Dropdown Menu -->
        <Transition name="menu">
          <div
            v-if="showLogoMenu"
            class="absolute top-full left-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-xl py-1 z-50"
          >
            <button
              @click="handleNewProject"
              class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            >
              <FilePlus class="w-4 h-4 text-text-muted" />
              <span>New Project</span>
            </button>
            <div class="my-1 border-t border-border" />
            <button
              @click="handleShowHelp"
              class="w-full flex items-center gap-3 px-3 py-2 text-sm text-text hover:bg-muted/10 transition-colors"
            >
              <HelpCircle class="w-4 h-4 text-text-muted" />
              <span>Help / Shortcuts</span>
            </button>
          </div>
        </Transition>
      </div>

      <!-- Divider -->
      <div class="h-4 w-px bg-border"></div>

      <!-- Title -->
      <div class="flex-1 min-w-0">
        <div v-if="isEditingTitle" class="flex-1">
          <input
            ref="titleInput"
            v-model="displayTitle"
            @blur="finishEditing"
            @keyup.enter="finishEditing"
            class="bg-transparent border border-border-focus w-full px-1.5 py-0.5 rounded text-sm text-text-primary font-medium focus:outline-none placeholder-text-muted"
          />
        </div>
        <div
          v-else
          @click="startEditing"
          class="text-sm font-medium text-text-primary px-1.5 py-0.5 rounded cursor-text truncate transition-all border border-transparent"
          :class="{ 'hover:border-border': !store.isTitleLocked }"
          :title="store.isTitleLocked ? 'Title locked by import' : 'Click to rename'"
        >
          {{ displayTitle }}
        </div>
      </div>
    </div>

    <!-- Center: Omnibar -->
    <div class="flex-1 flex justify-center">
      <div class="relative w-[400px] h-[28px]">
        <!-- Progress Bar (Background) -->
        <div v-if="store.isLoading" class="absolute inset-0 bg-primary/10 rounded overflow-hidden">
          <div class="h-full bg-primary/20 w-full animate-pulse origin-left"></div>
        </div>

        <button
          @click="$emit('command')"
          :disabled="store.isLoading"
          class="absolute inset-0 w-full h-full bg-transparent border border-border hover:border-selection/50 rounded flex items-center px-2 gap-2 transition-colors group cursor-text disabled:cursor-wait disabled:opacity-80"
          :class="store.isLoading ? 'border-primary/30' : 'bg-background'"
        >
          <Loader2 v-if="store.isLoading" class="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
          <Search
            v-else
            class="w-3.5 h-3.5 text-text-muted group-hover:text-text transition-colors shrink-0"
          />

          <span
            class="text-xs truncate min-w-0 flex-1 text-left"
            :class="store.isLoading ? 'text-primary' : 'text-text-muted'"
          >
            {{
              store.isLoading
                ? store.loadingMessage || 'Processing...'
                : 'Search commands... (Cmd+K)'
            }}
          </span>

          <div v-if="!store.isLoading" class="ml-auto shrink-0 flex items-center">
            <kbd
              class="hidden sm:inline-flex h-4 items-center gap-0.5 px-1.5 rounded bg-surface border border-border font-mono text-[10px] text-text-muted whitespace-nowrap"
              >⌘K</kbd
            >
          </div>
        </button>
      </div>
    </div>

    <!-- Right: Action Zone -->
    <div class="flex items-center justify-end gap-4 w-[280px]">
      <!-- Tool Switcher -->
      <div class="flex items-center gap-1 bg-surface rounded p-0.5 border border-border">
        <button
          class="p-1 rounded transition-colors"
          :class="
            store.currentTool === 'select'
              ? 'bg-interactive text-text-primary'
              : 'text-text-muted hover:text-text hover:bg-interactive'
          "
          @click="store.currentTool = 'select'"
        >
          <MousePointer2 class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1 rounded transition-colors"
          :class="
            store.currentTool === 'razor'
              ? 'bg-interactive text-text-primary'
              : 'text-text-muted hover:text-text hover:bg-interactive'
          "
          @click="store.currentTool = 'razor'"
        >
          <Scissors class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Theme Toggle -->
      <button
        @click="toggleTheme()"
        class="p-1 hover:bg-interactive rounded text-text-muted hover:text-text transition-colors"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      >
        <Sun v-if="isDark" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>

      <!-- Zoom -->
      <div class="flex items-center gap-2">
        <button
          @click="$emit('zoom-out')"
          class="p-1 hover:bg-interactive rounded text-text-muted hover:text-text transition-colors"
        >
          <Minus class="w-4 h-4" />
        </button>
        <span class="text-xs font-mono w-9 text-center text-text"
          >{{ Math.round(store.zoomPercentage) }}%</span
        >
        <button
          @click="$emit('zoom-in')"
          class="p-1 hover:bg-interactive rounded text-text-muted hover:text-text transition-colors"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <!-- Export CTA -->
      <button
        @click="$emit('export')"
        :disabled="!canExport"
        class="h-[28px] text-xs font-semibold px-3 rounded flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
        :class="canExport ? 'bg-primary hover:bg-primary-hover text-white' : ''"
      >
        <Download class="w-3.5 h-3.5" />
        <span>Export</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: all 0.15s ease-out;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
