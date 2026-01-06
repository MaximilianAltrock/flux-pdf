<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const timelineMarkerVariants = cva(
  'relative z-10 flex-shrink-0 w-[9px] h-[9px] mt-1.5 rounded-full border-2 transition-colors bg-background',
  {
    variants: {
      variant: {
        default: 'border-selection',
        active: 'border-selection bg-selection',
        muted: 'border-text-muted opacity-50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface Props {
  variant?: VariantProps<typeof timelineMarkerVariants>['variant']
  class?: HTMLAttributes['class']
  markerClass?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

const itemClass = computed(() =>
  cn(
    'relative flex gap-3 pb-4 last:pb-0 cursor-pointer group',
    // Vertical line connecting items
    'before:absolute before:left-[3.5px] before:top-0 before:bottom-0 before:w-[2px] before:bg-border',
    // First item: start line at the marker
    'first:before:top-[6px]',
    // Last item: end line at the marker center roughly
    'last:before:bottom-auto last:before:h-[6px]',
    props.class,
  ),
)

// We compute marker class based on variant
const markerClass = computed(() => cn(timelineMarkerVariants({ variant: props.variant }), props.markerClass))

const contentClass = computed(() => cn('flex-1 min-w-0'))
</script>

<template>
  <div :class="itemClass" @click="emit('click')">
    <!-- Marker -->
    <slot name="marker">
      <div :class="markerClass" />
    </slot>

    <!-- Content -->
    <div :class="contentClass">
      <slot />
    </div>
  </div>
</template>
