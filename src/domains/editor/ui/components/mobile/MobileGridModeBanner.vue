<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  message: string
}>()
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="props.visible"
      class="sticky top-0 z-20 bg-accent px-4 py-3 flex items-center justify-center text-accent-foreground border-b border-accent/50 shadow-sm"
    >
      <span class="text-sm font-medium">{{ props.message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
