import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { ZOOM } from '@/constants'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface SettingsPreferences {
  theme: ThemePreference
  defaultGridZoom: number
  defaultAuthor: string
  filenamePattern: string
  autoDeleteTrashDays: number
  reducedMotion: boolean
  autoGenerateOutlineSinglePage: boolean
}

export const DEFAULT_SETTINGS_PREFERENCES: SettingsPreferences = {
  theme: 'system',
  defaultGridZoom: ZOOM.DEFAULT,
  defaultAuthor: '',
  filenamePattern: '{name}_v{version}',
  autoDeleteTrashDays: 30,
  reducedMotion: false,
  autoGenerateOutlineSinglePage: true,
}

export const useSettingsStore = defineStore('settings', () => {
  const preferences = useStorage<SettingsPreferences>('flux-settings', {
    ...DEFAULT_SETTINGS_PREFERENCES,
  })

  function resetPreferences(): void {
    preferences.value = {
      ...DEFAULT_SETTINGS_PREFERENCES,
    }
  }

  return {
    preferences,
    resetPreferences,
  }
})
