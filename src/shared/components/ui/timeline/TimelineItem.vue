<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, inject, useSlots } from 'vue'
import { cn } from '@/shared/lib/utils'
import TimelineConnector from './TimelineConnector.vue'
import TimelineContent from './TimelineContent.vue'
import TimelineDescription from './TimelineDescription.vue'
import TimelineHeader from './TimelineHeader.vue'
import TimelineIcon from './TimelineIcon.vue'
import TimelineTime from './TimelineTime.vue'
import TimelineTitle from './TimelineTitle.vue'
import { timelineContextKey, type TimelineVariant } from './context'

type TimelineStatus = 'completed' | 'in-progress' | 'pending' | 'error'
type TimelineColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'destructive'

interface Props {
  date?: string | number | Date
  title?: string
  description?: string
  status?: TimelineStatus
  iconColor?: TimelineColor
  connectorColor?: TimelineColor
  showConnector?: boolean
  iconSize?: 'sm' | 'md' | 'lg'
  variant?: TimelineVariant
  timeFormat?: Intl.DateTimeFormatOptions
  contentClass?: HTMLAttributes['class']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  status: 'completed',
  showConnector: true,
  iconSize: 'md',
})

const slots = useSlots()
const timelineContext = inject(timelineContextKey, null)

const hasTime = computed(() => Boolean(slots.time) || props.date !== undefined)
const hasTitle = computed(() => Boolean(slots.title) || Boolean(props.title))
const hasDescription = computed(() => Boolean(slots.description) || Boolean(props.description))

const resolvedVariant = computed(
  () => props.variant ?? timelineContext?.value?.variant ?? 'default',
)
const isHistoryVariant = computed(() => resolvedVariant.value === 'history')

const itemClass = computed(() =>
  cn('relative w-full', isHistoryVariant.value ? 'pl-8 py-2 z-10' : '', props.class),
)

const resolvedContentClass = computed(() =>
  cn(props.contentClass, isHistoryVariant.value ? 'gap-0' : undefined),
)

const gridClass = computed(() => {
  if (hasTime.value) {
    return 'grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[minmax(0,8rem)_auto_minmax(0,1fr)] gap-3 sm:gap-4 items-start'
  }
  return 'grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-4 items-start'
})

const markerPositionClass = computed(() => {
  if (props.iconSize === 'sm') return 'left-[15px] top-3.5'
  if (props.iconSize === 'lg') return 'left-[12px] top-2.5'
  return 'left-[13px] top-3'
})

const connectorHeightClass = computed(() => {
  if (props.iconSize === 'sm') return 'h-10'
  if (props.iconSize === 'lg') return 'h-14'
  return 'h-12'
})

const shouldShowConnector = computed(() => props.showConnector && !isHistoryVariant.value)
</script>

<template>
  <li
    :class="itemClass"
    :data-state="status"
    :aria-current="status === 'in-progress' ? 'step' : undefined"
  >
    <div v-if="isHistoryVariant">
      <slot name="marker">
        <TimelineIcon
          variant="dot"
          :status="status"
          :color="iconColor"
          :size="iconSize"
          :class="cn('absolute z-20', markerPositionClass)"
        >
          <slot name="icon" />
        </TimelineIcon>
      </slot>

      <TimelineContent :class="resolvedContentClass">
        <div v-if="hasTime" class="mb-1">
          <slot name="time">
            <TimelineTime :date="date" :format="timeFormat" />
          </slot>
        </div>

        <TimelineHeader v-if="hasTitle">
          <slot name="title">
            <TimelineTitle>{{ title }}</TimelineTitle>
          </slot>
        </TimelineHeader>

        <slot name="description" v-if="hasDescription">
          <TimelineDescription>{{ description }}</TimelineDescription>
        </slot>

        <slot />
      </TimelineContent>
    </div>

    <div v-else :class="gridClass">
      <div v-if="hasTime" class="hidden sm:flex flex-col items-end pt-1 pr-2 text-right">
        <slot name="time">
          <TimelineTime :date="date" :format="timeFormat" />
        </slot>
      </div>

      <div class="relative flex flex-col items-center">
        <slot name="marker">
          <TimelineIcon :status="status" :color="iconColor" :size="iconSize">
            <slot name="icon" />
          </TimelineIcon>
        </slot>
        <TimelineConnector
          v-if="shouldShowConnector"
          :status="status"
          :color="connectorColor"
          :class="cn('mt-2', connectorHeightClass)"
        />
      </div>

      <TimelineContent :class="resolvedContentClass">
        <div v-if="hasTime" class="sm:hidden mb-1">
          <slot name="time">
            <TimelineTime :date="date" :format="timeFormat" />
          </slot>
        </div>

        <TimelineHeader v-if="hasTitle">
          <slot name="title">
            <TimelineTitle>{{ title }}</TimelineTitle>
          </slot>
        </TimelineHeader>

        <slot name="description" v-if="hasDescription">
          <TimelineDescription>{{ description }}</TimelineDescription>
        </slot>

        <slot />
      </TimelineContent>
    </div>
  </li>
</template>
