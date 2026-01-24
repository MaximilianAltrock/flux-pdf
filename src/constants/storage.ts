export const SCHEMA_VERSION = {
  COMMAND: 1,
  SESSION: 1,
  PROJECT: 1,
  DB: 2,
} as const

export const HISTORY = {
  MAX_ENTRIES: 50,
  POINTER_START: -1,
} as const
