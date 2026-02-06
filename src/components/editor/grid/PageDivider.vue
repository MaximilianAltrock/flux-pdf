<script setup lang="ts">
import { computed } from 'vue'
import { Scissors } from 'lucide-vue-next'

const props = defineProps<{
  variant?: 'desktop' | 'mobile'
  label?: string
}>()

const isMobile = computed(() => props.variant === 'mobile')
const label = computed(
  () => props.label ?? (isMobile.value ? 'New Document' : 'New Document Section'),
)
</script>

<template>
  <div
    :class="[
      isMobile
        ? 'col-span-full py-4 flex items-center justify-center relative select-none'
        : 'h-full py-8 flex items-center justify-center relative select-none group/divider',
    ]"
  >
    <div
      :class="[
        isMobile
          ? 'absolute inset-x-0 h-px bg-border/60'
          : 'absolute inset-x-0 h-px bg-border/70 group-hover/divider:bg-primary/40 transition-colors',
      ]"
    ></div>

    <div
      :class="[
        'relative bg-background/80 border border-border shadow-xs flex items-center',
        isMobile
          ? 'px-4 py-1.5 gap-2.5 opacity-90'
          : 'px-4 py-1.5 gap-2 opacity-70 transition-opacity group-hover/divider:opacity-100',
      ]"
    >
      <div v-if="!isMobile" class="p-1 bg-primary/10 rounded-sm">
        <Scissors class="w-3.5 h-3.5 text-primary" />
      </div>
      <Scissors v-else class="w-3 h-3 text-primary" />
      <span
        :class="[
          'ui-kicker ui-mono text-muted-foreground',
          isMobile ? 'tracking-[0.15em]' : 'tracking-[0.2em]',
        ]"
      >
        {{ label }}
      </span>
    </div>
  </div>
</template>
