<script setup lang="ts">
import { computed } from 'vue'
import { MoreHorizontal, Download, Share2 } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { useMobileActionRegistry } from '@/composables/useMobileActionRegistry'
import { Button } from '@/components/ui/button'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  export: []
  more: []
}>()

const { haptic, canShareFiles } = useMobile()
const { primaryActions } = useMobileActionRegistry(props.actions)

// Mode helpers
const mode = computed(() => props.state.mobileMode.value)
const isBrowse = computed(() => mode.value === 'browse')
const isSelect = computed(() => mode.value === 'select')
const isMove = computed(() => mode.value === 'move')

const hasPages = computed(() => props.state.document.pageCount > 0)

function handleExport() {
  haptic('light')
  emit('export')
}

function handleMore() {
  haptic('light')
  emit('more')
}

function handleActionTap(action: (typeof primaryActions.value)[0]) {
  if (action.disabled) return
  action.execute()
}
</script>

<template>
  <!-- Hidden in Move mode -->
  <Transition name="slide-up">
    <footer
      v-if="!isMove"
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

      <!-- Browse Mode: Export Button -->
      <div v-else-if="isBrowse" class="h-16 flex items-center px-4">
        <Button
          v-if="hasPages"
          class="flex-1 h-12 flex items-center justify-center gap-2 font-semibold text-sm"
          @click="handleExport"
        >
          <component :is="canShareFiles ? Share2 : Download" class="w-5 h-5" />
          <span>{{ canShareFiles ? 'Export & Share' : 'Export PDF' }}</span>
        </Button>

        <div v-else class="flex-1 text-center text-muted-foreground text-sm py-4">
          Add a PDF to get started
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
