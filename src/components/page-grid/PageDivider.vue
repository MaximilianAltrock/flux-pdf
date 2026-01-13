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
        ? 'col-span-full py-5 flex items-center justify-center relative select-none'
        : 'h-full py-10 flex items-center justify-center relative select-none group/divider transition-all duration-300',
    ]"
  >
    <div
      :class="[
        isMobile
          ? 'absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent'
          : 'absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent group-hover/divider:via-primary transition-all duration-500',
      ]"
    ></div>
    <div
      v-if="!isMobile"
      class="absolute inset-x-1/4 h-[2px] bg-primary/5 blur-sm group-hover/divider:bg-primary/20 group-hover/divider:inset-x-0 group-hover/divider:blur-md transition-all duration-700"
    ></div>

    <div
      :class="[
        'relative glass-surface bg-background/90 rounded-full border-border/80 shadow-md flex items-center',
        isMobile
          ? 'px-4 py-1.5 gap-2.5'
          : 'backdrop-blur-md px-5 py-2 gap-3 transition-all duration-300 group-hover/divider:border-primary/50 group-hover/divider:shadow-lg group-hover/divider:scale-[1.02] -translate-y-0.5',
      ]"
    >
      <div v-if="!isMobile" class="p-1.5 bg-primary/10 rounded-full">
        <Scissors class="w-3.5 h-3.5 text-primary animate-pulse" />
      </div>
      <Scissors v-else class="w-3 h-3 text-primary animate-pulse" />
      <span
        :class="[
          'font-mono font-bold text-muted-foreground uppercase',
          isMobile ? 'text-[0.65rem] tracking-[0.15em]' : 'text-xxs tracking-[0.25em]',
        ]"
      >
        {{ label }}
      </span>
    </div>
  </div>
</template>
