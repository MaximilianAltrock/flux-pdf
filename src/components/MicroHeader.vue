<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { FilePlus, HelpCircle, MoreVertical } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
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
const router = useRouter()

// Computed for Title to handle store sync and validation
const displayTitle = computed({
  get: () => props.state.document.projectTitle,
  set: (val) => {
    props.actions.setProjectTitleDraft(val)
  },
})

async function startEditing() {
  isEditingTitle.value = true
  await nextTick()
  const el =
    titleInput.value?.$el?.querySelector?.('input') || titleInput.value?.$el || titleInput.value
  el?.focus()
  el?.select?.()
}

function finishEditing() {
  isEditingTitle.value = false
  props.actions.commitProjectTitle()
}

function goToDashboard() {
  router.push('/')
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
    class="h-[48px] border-b border-sidebar-border text-sidebar-foreground flex items-center justify-between px-4 shrink-0 z-30 relative select-none bg-sidebar"
  >
    <!-- Left: Context Zone -->
    <div class="flex items-center gap-4 w-[280px]">
      <Button
        variant="ghost"
        size="icon-sm"
        class="group"
        @click="goToDashboard"
        aria-label="Open Dashboard"
      >
        <div
          class="w-4 h-4 bg-gradient-to-br from-primary to-primary/60 rounded-[3px] shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_30%,transparent)] group-hover:scale-110 transition-transform"
        ></div>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground">
            <MoreVertical class="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-48">
          <DropdownMenuItem @select="emit('new-project')" class="gap-2">
            <FilePlus class="w-4 h-4" />
            <span class="font-medium">New Project</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="emit('show-help')" class="gap-2">
            <HelpCircle class="w-4 h-4" />
            <span class="font-medium">Help / Shortcuts</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" class="!h-3 opacity-30" />

      <div class="flex-1 min-w-0">
        <div v-if="isEditingTitle" class="flex-1">
          <Input
            ref="titleInput"
            v-model="displayTitle"
            @blur="finishEditing"
            @keyup.enter="finishEditing"
            class="h-7 text-xs font-semibold px-2"
          />
        </div>
        <div
          v-else
          @click="startEditing"
          @keydown.enter.prevent="startEditing"
          @keydown.space.prevent="startEditing"
          class="ui-label text-foreground/80 px-2 py-1 rounded-sm cursor-text truncate transition-colors border border-transparent hover:bg-muted/40 hover:text-foreground inline-flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none"
          :class="{ 'opacity-50 pointer-events-none': state.document.isTitleLocked }"
          :title="state.document.isTitleLocked ? 'Title locked by import' : 'Click to rename'"
          :aria-label="
            state.document.isTitleLocked ? 'Title locked by import' : 'Edit project title'
          "
          :tabindex="state.document.isTitleLocked ? -1 : 0"
          role="button"
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
