<script setup lang="ts">
import { computed } from 'vue'
import { MoreHorizontal, Download, Share2, Plus, SlidersHorizontal } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { useMobileActionRegistry } from '@/composables/useMobileActionRegistry'
import { Button } from '@/components/ui/button'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useUiStore } from '@/stores/ui'
import { useDocumentStore } from '@/stores/document'

const actions = useDocumentActionsContext()
const ui = useUiStore()
const document = useDocumentStore()

const emit = defineEmits<{
  export: []
  exportOptions: []
  add: []
  more: []
}>()

const { haptic, canShareFiles } = useMobile()
const { primaryActions } = useMobileActionRegistry(actions)

// Mode helpers
const mode = computed(() => ui.mobileMode)
const isSplit = computed(() => ui.currentTool === 'razor')
const isBrowse = computed(() => mode.value === 'browse')
const isSelect = computed(() => mode.value === 'select')
const isMove = computed(() => mode.value === 'move')

const hasPages = computed(() => document.pageCount > 0)

function handleExport() {
  haptic('light')
  emit('export')
}

function handleExportOptions() {
  haptic('light')
  emit('exportOptions')
}

function handleMore() {
  haptic('light')
  emit('more')
}

function handleAdd() {
  haptic('medium')
  emit('add')
}

function handleActionTap(action: (typeof primaryActions.value)[0]) {
  if (action.disabled) return
  action.execute()
}
</script>

<template>
  <!-- Hidden in Move/Split mode -->
  <Transition name="slide-up">
    <footer
      v-if="!isMove && !isSplit"
      class="shrink-0 bg-card border-t border-border"
      style="padding-bottom: env(safe-area-inset-bottom, 0px)"
    >
      <!-- Selection Mode: Primary Actions from Registry + More -->
      <div v-if="isSelect" class="h-16 flex items-center justify-around px-2 gap-1">
        <Button
          v-for="action in primaryActions"
          :key="action.id"
          variant="ghost"
          :disabled="action.disabled"
          class="flex flex-col items-center justify-center gap-0.5 px-2 min-w-[64px] h-12 rounded-lg transition-colors hover:bg-muted/20 active:bg-muted/30"
          :class="[
            action.isDestructive
              ? 'text-destructive active:text-destructive/80'
              : 'text-foreground active:text-primary',
            action.disabled ? 'opacity-40' : '',
          ]"
          @click="handleActionTap(action)"
        >
          <component :is="action.icon" class="w-5 h-5" />
          <span class="text-xs font-medium">{{ action.label }}</span>
        </Button>

        <!-- More button -->
        <Button
          variant="ghost"
          class="flex flex-col items-center justify-center gap-0.5 px-2 min-w-[64px] h-12 rounded-lg text-foreground active:text-primary transition-colors hover:bg-muted/20 active:bg-muted/30"
          @click="handleMore"
        >
          <MoreHorizontal class="w-5 h-5" />
          <span class="text-xs font-medium">More</span>
        </Button>
      </div>

      <!-- Browse Mode: Add + Export -->
      <div v-else-if="isBrowse" class="h-16 flex items-center px-4 gap-3">
        <Button
          class="flex-1 h-12 flex items-center justify-center gap-2 font-semibold text-sm"
          @click="handleAdd"
        >
          <Plus class="w-5 h-5" />
          <span>Add</span>
        </Button>
        <div class="flex-1 flex h-12 rounded-lg overflow-hidden border border-border ui-panel-muted">
          <Button
            variant="ghost"
            class="flex-1 h-full flex items-center justify-center gap-2 font-semibold text-sm rounded-none"
            :disabled="!hasPages"
            @click="handleExport"
          >
            <component :is="canShareFiles ? Share2 : Download" class="w-5 h-5" />
            <span>Export</span>
          </Button>
          <div class="w-px bg-border/60"></div>
          <Button
            variant="ghost"
            size="icon"
            class="h-full w-12 rounded-none text-muted-foreground"
            :disabled="!hasPages"
            @click="handleExportOptions"
            aria-label="Export options"
          >
            <SlidersHorizontal class="w-5 h-5" />
          </Button>
        </div>
      </div>
    </footer>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
