<script setup lang="ts">
import { ref, computed } from 'vue'
import { FilePlus, HelpCircle } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import HeaderOmnibar from './header/HeaderOmnibar.vue'
import HeaderControls from './header/HeaderControls.vue'
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

      <Separator orientation="vertical" class="!h-4" />

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
          :class="{ 'opacity-50 pointer-events-none': state.document.isTitleLocked }"
          :title="state.document.isTitleLocked ? 'Title locked by import' : 'Click to rename'"
        >
          {{ displayTitle }}
        </div>
      </div>
    </div>

    <!-- Center: Omnibar -->
    <HeaderOmnibar :state="state" @command="emit('command')" />

    <!-- Right: Action Zone -->
    <HeaderControls
      :state="state"
      :actions="actions"
      @zoom-in="emit('zoom-in')"
      @zoom-out="emit('zoom-out')"
      @export="emit('export')"
    />
  </header>
</template>
