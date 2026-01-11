export type TimelineSize = 'sm' | 'md' | 'lg'
export type TimelineVariant = 'default' | 'history'

export interface TimelineContext {
  size: TimelineSize
  variant: TimelineVariant
}

export const timelineContextKey = Symbol('timelineContext')
