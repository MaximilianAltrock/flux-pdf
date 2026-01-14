export const ZOOM = {
  DEFAULT: 220,
  MIN: 120,
  MAX: 320,
  STEP: 20,
  PERCENT_BASE: 200,
  PERCENT_MAX: 100,
} as const

export const GRID_NAVIGATION = {
  DEFAULT_COLUMNS: 4,
  MIN_COLUMNS: 1,
  CONTAINER_PADDING_PX: 48,
  THUMBNAIL_OFFSET_PX: 20,
  GAP_PX: 16,
} as const

export const THUMBNAIL = {
  CACHE_MAX: 100,
  DEFAULT_WIDTH: 200,
  SCALE_FACTOR: 2,
} as const

export const MOBILE = {
  BREAKPOINT_PX: 768,
  FALLBACK_WIDTH_PX: 1024,
  FALLBACK_HEIGHT_PX: 768,
} as const

export const HAPTIC_PATTERNS = {
  light: [10],
  medium: [20],
  heavy: [30, 10, 30],
  success: [20, 50, 20],
} as const
