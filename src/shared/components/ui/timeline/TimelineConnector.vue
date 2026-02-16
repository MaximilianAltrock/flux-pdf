<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/shared/lib/utils'

type TimelineStatus = 'completed' | 'in-progress' | 'pending' | 'error'
type TimelineColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'destructive'

interface Props {
  status?: TimelineStatus
  color?: TimelineColor
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  status: 'completed',
})

const colorClass = computed(() => {
  if (props.color === 'primary') return 'bg-primary'
  if (props.color === 'secondary') return 'bg-secondary'
  if (props.color === 'accent') return 'bg-accent'
  if (props.color === 'muted') return 'bg-muted'
  if (props.color === 'destructive') return 'bg-destructive/60'

  if (props.status === 'in-progress') return 'bg-gradient-to-b from-primary to-muted'
  if (props.status === 'pending') return 'bg-muted'
  if (props.status === 'error') return 'bg-destructive/60'
  return 'bg-primary'
})
</script>

<template>
  <div :class="cn('w-px rounded-full transition-colors', colorClass, props.class)" />
</template>
