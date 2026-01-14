export const SCHEMA_VERSION = {
  COMMAND: 1,
  SESSION: 1,
  DB: 1,
} as const

export const HISTORY = {
  MAX_ENTRIES: 50,
  POINTER_START: -1,
} as const
