<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, useSlots } from 'vue'
import { cn } from '@/shared/lib/utils'

type TimelineStatus = 'completed' | 'in-progress' | 'pending' | 'error'
type TimelineColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'destructive'

interface Props {
  color?: TimelineColor
  status?: TimelineStatus
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'dot'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  status: 'completed',
  size: 'md',
  variant: 'default',
})

const slots = useSlots()

const resolvedColor = computed<TimelineColor>(() => {
  if (props.color) return props.color
  if (props.status === 'pending') return 'muted'
  if (props.status === 'error') return 'destructive'
  return 'primary'
})

const sizeClasses = computed(() => {
  if (props.variant === 'dot') {
    if (props.size === 'sm') return 'h-[9px] w-[9px]'
    if (props.size === 'lg') return 'h-[14px] w-[14px]'
    return 'h-[12px] w-[12px]'
  }
  if (props.size === 'sm') return 'h-6 w-6 ring-4'
  if (props.size === 'lg') return 'h-10 w-10 ring-8'
  return 'h-8 w-8 ring-6'
})

const colorClasses = computed(() => {
  if (props.variant === 'dot') {
    const borderClass =
      resolvedColor.value === 'secondary'
        ? 'border-secondary'
        : resolvedColor.value === 'accent'
          ? 'border-accent'
          : resolvedColor.value === 'muted'
            ? 'border-muted-foreground'
            : resolvedColor.value === 'destructive'
              ? 'border-destructive'
              : 'border-primary'

    const fillClass =
      props.status === 'in-progress' || props.status === 'error'
        ? resolvedColor.value === 'secondary'
          ? 'bg-secondary'
          : resolvedColor.value === 'accent'
            ? 'bg-accent'
            : resolvedColor.value === 'muted'
              ? 'bg-muted'
              : resolvedColor.value === 'destructive'
                ? 'bg-destructive'
                : 'bg-primary'
        : 'bg-background'

    const opacityClass = props.status === 'pending' ? 'opacity-50' : ''

    return cn(borderClass, fillClass, opacityClass)
  }

  if (resolvedColor.value === 'secondary') return 'bg-secondary text-secondary-foreground'
  if (resolvedColor.value === 'accent') return 'bg-accent text-accent-foreground'
  if (resolvedColor.value === 'muted') return 'bg-muted text-muted-foreground'
  if (resolvedColor.value === 'destructive') return 'bg-destructive text-destructive-foreground'
  return 'bg-primary text-primary-foreground'
})

const hasIcon = computed(() => {
  const content = slots.default?.()
  return Boolean(content && content.length > 0)
})
</script>

<template>
  <div
    :class="
      cn(
        props.variant === 'dot'
          ? 'relative rounded-full border-2 transition-colors'
          : 'relative flex items-center justify-center rounded-full ring-background shadow-sm transition-colors',
        props.status === 'in-progress' && 'animate-pulse border-primary bg-primary',
        sizeClasses,
        colorClasses,
        props.class,
      )
    "
  >
    <slot />
    <span
      v-if="!hasIcon && props.variant !== 'dot'"
      class="h-2.5 w-2.5 rounded-full bg-current/80"
    />
  </div>
</template>
