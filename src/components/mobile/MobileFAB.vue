<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
}>()

const emit = defineEmits<{
  add: []
}>()

const { haptic } = useMobile()

// FAB is only visible in Browse mode and not in Split mode
const isVisible = computed(
  () => props.state.mobileMode.value === 'browse' && props.state.currentTool.value !== 'razor',
)

function handleTap() {
  haptic('medium')
  emit('add')
}
</script>

<template>
  <Transition name="fab-pop">
    <button
      v-if="isVisible"
      class="fixed z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform duration-200 active:scale-90 bg-primary text-primary-foreground right-4 bottom-24"
      style="margin-bottom: env(safe-area-inset-bottom, 0px)"
      @click="handleTap"
    >
      <Plus class="w-6 h-6" />
    </button>
  </Transition>
</template>

<style scoped>
.fab-pop-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-pop-leave-active {
  transition: all 0.15s ease-in;
}

.fab-pop-enter-from,
.fab-pop-leave-to {
  opacity: 0;
  transform: scale(0.5);
}
</style>
