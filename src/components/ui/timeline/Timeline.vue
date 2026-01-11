<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, provide } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { timelineContextKey, type TimelineVariant, type TimelineSize } from './context'

const timelineVariants = cva('relative flex flex-col list-none p-0 m-0', {
  variants: {
    size: {
      sm: 'gap-4',
      md: 'gap-6',
      lg: 'gap-8',
    },
    variant: {
      default: '',
      history:
        'gap-0 before:absolute before:inset-y-0 before:left-[19px] before:w-px before:rounded-full before:bg-border before:z-0',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
})

interface Props {
  size?: TimelineSize
  variant?: TimelineVariant
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default',
})

const timelineClass = computed(() =>
  cn(timelineVariants({ size: props.size, variant: props.variant }), props.class),
)

provide(
  timelineContextKey,
  computed(() => ({
    size: props.size,
    variant: props.variant,
  })),
)
</script>

<template>
  <ol aria-label="Timeline" :class="timelineClass">
    <slot />
  </ol>
</template>
