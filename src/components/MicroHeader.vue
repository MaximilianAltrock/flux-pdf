<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Search,
  Download,
  MousePointer2,
  Scissors,
  Minus,
  Plus,
  FilePlus,
  HelpCircle,
} from 'lucide-vue-next'
import ThemeToggle from '@/components/ThemeToggle.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { Spinner } from '@/components/ui/spinner'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const isEditingTitle = ref(false)
const titleInput = ref<InstanceType<typeof Input> | null>(null)

// Computed for Title to handle store sync and validation
const displayTitle = computed({
  get: () => props.state.document.projectTitle,
  set: (val) => {
    props.actions.setProjectTitleDraft(val)
  },
})

const currentTool = computed({
  get: () => props.state.currentTool.value,
  set: (val) => {
    props.actions.setCurrentTool(val as 'select' | 'razor')
  },
})

function startEditing() {
  isEditingTitle.value = true
  setTimeout(() => {
    const el =
      titleInput.value?.$el?.querySelector?.('input') || titleInput.value?.$el || titleInput.value
    el?.focus()
    el?.select?.()
  }, 0)
}

function finishEditing() {
  isEditingTitle.value = false
  props.actions.commitProjectTitle()
}

// Export logic
const canExport = computed(() => props.state.document.pageCount > 0)

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
    class="h-[48px] border-b border-border flex items-center justify-between px-4 shrink-0 z-30 relative select-none bg-sidebar backdrop-blur-md"
  >
    <!-- Left: Context Zone -->
    <div class="flex items-center gap-4 w-[280px]">
      <!-- Logo with Dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="w-8 h-8 hover:bg-primary/10 transition-colors">
            <div class="w-4 h-4 bg-primary rounded-[2px]"></div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-48">
          <DropdownMenuItem @select="emit('new-project')">
            <FilePlus class="w-4 h-4 mr-2" />
            <span>New Project</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="emit('show-help')">
            <HelpCircle class="w-4 h-4 mr-2" />
            <span>Help / Shortcuts</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Divider -->
      <Separator orientation="vertical" class="!h-4" />

      <!-- Title -->
      <div class="flex-1 min-w-0">
        <div v-if="isEditingTitle" class="flex-1">
          <Input
            ref="titleInput"
            v-model="displayTitle"
            @blur="finishEditing"
            @keyup.enter="finishEditing"
            class="h-7 text-sm font-medium px-2 focus-visible:ring-1"
          />
        </div>
        <div
          v-else
          @click="startEditing"
          class="text-sm font-medium text-primary px-2 py-1 rounded cursor-text truncate transition-all border border-transparent hover:bg-muted/50"
          :class="{ 'opacity-50 pointer-events-none': props.state.document.isTitleLocked }"
          :title="
            props.state.document.isTitleLocked ? 'Title locked by import' : 'Click to rename'
          "
        >
          {{ displayTitle }}
        </div>
      </div>
    </div>

    <!-- Center: Omnibar -->
    <div class="flex-1 flex justify-center">
      <div class="relative w-[400px]">
        <!-- Progress Bar (Background) -->
        <div
          v-if="props.state.isLoading.value"
          class="absolute inset-0 bg-primary/5 rounded overflow-hidden"
        >
          <div class="h-full bg-primary/10 w-full animate-pulse origin-left"></div>
        </div>

        <button
          @click="$emit('command')"
          :disabled="props.state.isLoading.value"
          class="w-full h-[32px] bg-muted border border-border hover:border-primary/50 rounded-md flex items-center px-3 gap-2 transition-all group cursor-text disabled:cursor-wait disabled:opacity-80"
          :class="{ 'border-primary/30': props.state.isLoading.value }"
        >
          <Spinner
            v-if="props.state.isLoading.value"
            class="w-3.5 h-3.5 text-primary shrink-0"
          />
          <Search
            v-else
            class="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
          />

          <span
            class="text-xs truncate min-w-0 flex-1 text-left"
            :class="
              props.state.isLoading.value
                ? 'text-primary font-medium'
                : 'text-muted-foreground group-hover:text-foreground'
            "
          >
            {{
              props.state.isLoading.value
                ? props.state.loadingMessage.value || 'Processing...'
                : 'Search commands...'
            }}
          </span>

          <div
            v-if="!props.state.isLoading.value"
            class="ml-auto shrink-0 flex items-center gap-1.5"
          >
            <Kbd
              class="hidden sm:inline-flex rounded bg-background border border-border font-mono text-[9px] text-muted-foreground whitespace-nowrap"
            >
              ⌘K
            </Kbd>
          </div>
        </button>
      </div>
    </div>

    <!-- Right: Action Zone -->
    <div class="flex items-center justify-end gap-3 w-[280px]">
      <!-- Tool Switcher -->
      <ToggleGroup type="single" v-model="currentTool" variant="outline" class="h-8">
        <ToggleGroupItem value="select" aria-label="Select tool" class="px-2 h-7">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="flex items-center justify-center">
                <MousePointer2 class="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" :side-offset="8">
              <p>Select Tool <span class="text-muted-foreground ml-1 text-xxs">(V)</span></p>
            </TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
        <ToggleGroupItem value="razor" aria-label="Razor tool" class="px-2 h-7">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="flex items-center justify-center">
                <Scissors class="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" :side-offset="8">
              <p>Razor Tool <span class="text-muted-foreground ml-1 text-xxs">(R)</span></p>
            </TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator orientation="vertical" class="!h-4" />

      <!-- Theme Toggle -->
      <ThemeToggle />

      <Separator orientation="vertical" class="!h-4" />

      <!-- Zoom -->
      <div class="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-foreground"
              @click="$emit('zoom-out')"
            >
              <Minus class="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" :side-offset="8">
            <p>Zoom Out <span class="text-muted-foreground ml-1 text-xxs">(⌘-)</span></p>
          </TooltipContent>
        </Tooltip>

        <span class="text-[11px] font-mono w-10 text-center text-muted-foreground select-none">
          {{ Math.round(props.state.zoomPercentage.value) }}%
        </span>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:text-foreground"
              @click="$emit('zoom-in')"
            >
              <Plus class="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" :side-offset="8">
            <p>Zoom In <span class="text-muted-foreground ml-1 text-xxs">(⌘+)</span></p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" class="!h-4" />

      <!-- Export CTA -->
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            @click="$emit('export')"
            :disabled="!canExport"
            size="sm"
            class="h-[30px] font-bold px-4 gap-2 shadow-sm"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Export</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent v-if="!canExport" side="bottom" :side-offset="8">
          <p>Import files to export</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </header>
</template>
