export const ROTATION_DELTA_DEGREES = {
  LEFT: -90,
  RIGHT: 90,
} as const

export type RotationDelta =
  (typeof ROTATION_DELTA_DEGREES)[keyof typeof ROTATION_DELTA_DEGREES]

export const ROTATION_FULL_DEGREES = 360
export const ROTATION_DEFAULT_DEGREES = 0

export const ROTATION_ANGLES = [0, 90, 180, 270] as const
export type RotationAngle = (typeof ROTATION_ANGLES)[number]

export const PAGE_NUMBER_BASE = 1
export const PDF_PAGE_INDEX_BASE = 1

export const DIFF_REQUIRED_SELECTION = 2
