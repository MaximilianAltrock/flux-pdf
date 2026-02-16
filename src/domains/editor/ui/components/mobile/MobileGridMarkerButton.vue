<script setup lang="ts">
const props = defineProps<{
  label: string
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <button
    class="col-span-full h-12 -my-1 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center gap-2 text-primary text-sm font-medium bg-primary/5 active:bg-primary/10 transition-colors"
    @click="emit('select')"
  >
    <slot />
    <span>{{ props.label }}</span>
  </button>
</template>
