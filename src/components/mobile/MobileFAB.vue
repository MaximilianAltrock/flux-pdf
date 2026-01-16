<script setup lang="ts">
import { Plus, Wrench } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'

const props = defineProps<{
  selectionMode: boolean
  selectedCount: number
}>()

const emit = defineEmits<{
  add: []
  actions: []
}>()

const { haptic } = useMobile()

function handleTap() {
  haptic('medium')

  if (props.selectionMode && props.selectedCount > 0) {
    // Selection mode: open quick actions
    emit('actions')
  } else {
    // Normal mode: add files
    emit('add')
  }
}
</script>

<template>
  <button
    class="fixed z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-90 bg-primary right-4 bottom-24"
    style="margin-bottom: env(safe-area-inset-bottom, 0px)"
    @click="handleTap"
  >
    <!-- Transform icon based on state -->
    <Transition name="fab-icon" mode="out-in">
      <Wrench
        v-if="selectionMode && selectedCount > 0"
        key="wrench"
        class="w-6 h-6 text-primary-foreground"
      />
      <Plus v-else key="plus" class="w-6 h-6 text-primary-foreground" />
    </Transition>
  </button>
</template>

<style scoped>
.fab-icon-enter-active,
.fab-icon-leave-active {
  transition: all 0.15s ease;
}

.fab-icon-enter-from {
  opacity: 0;
  transform: scale(0.5) rotate(-90deg);
}

.fab-icon-leave-to {
  opacity: 0;
  transform: scale(0.5) rotate(90deg);
}
</style>
