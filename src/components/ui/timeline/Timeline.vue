<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  /** Alignment of content relative to the line */
  align?: 'left' | 'right' | 'alternate'
  /** Orientation of the timeline */
  orientation?: 'vertical' | 'horizontal'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  align: 'left',
  orientation: 'vertical',
})

const timelineClass = computed(() =>
  cn(
    'relative',
    props.orientation === 'vertical' ? 'flex flex-col' : 'flex flex-row',
    props.class,
  ),
)
</script>

<template>
  <div :class="timelineClass" :data-align="align" :data-orientation="orientation">
    <slot />
  </div>
</template>
