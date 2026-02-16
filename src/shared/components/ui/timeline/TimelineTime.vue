<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/shared/lib/utils'

interface Props {
  date?: string | number | Date
  format?: Intl.DateTimeFormatOptions
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const defaultFormat: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
}

const dateValue = computed(() => {
  if (!props.date) return null
  const dateObj = new Date(props.date)
  if (Number.isNaN(dateObj.getTime())) return null
  return dateObj
})

const formattedDate = computed(() => {
  if (!dateValue.value) return ''
  try {
    return new Intl.DateTimeFormat('en-US', { ...defaultFormat, ...props.format }).format(
      dateValue.value,
    )
  } catch {
    return ''
  }
})

const dateTimeValue = computed(() => (dateValue.value ? dateValue.value.toISOString() : undefined))
</script>

<template>
  <time
    :dateTime="dateTimeValue"
    :class="cn('text-xs font-medium tracking-tight text-muted-foreground', props.class)"
  >
    <slot>{{ formattedDate }}</slot>
  </time>
</template>
