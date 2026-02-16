export const STORAGE_KEYS = {
  LAST_ACTIVE_PROJECT_ID: 'lastActiveProjectId',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
