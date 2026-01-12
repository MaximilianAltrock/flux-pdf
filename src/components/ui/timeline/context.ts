import type { ComputedRef, InjectionKey } from 'vue'

export type TimelineSize = 'sm' | 'md' | 'lg'
export type TimelineVariant = 'default' | 'history'

export interface TimelineContext {
  size: TimelineSize
  variant: TimelineVariant
}

export const timelineContextKey: InjectionKey<ComputedRef<TimelineContext>> =
  Symbol('timelineContext')
