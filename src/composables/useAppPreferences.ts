import { storeToRefs } from 'pinia'
import { useColorMode } from '@vueuse/core'
import { watchEffect } from 'vue'
import { useSettingsStore } from '@/stores/settings'

function toColorModeTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' | 'auto' {
  return theme === 'system' ? 'auto' : theme
}

export function useAppPreferences() {
  const settings = useSettingsStore()
  const { preferences } = storeToRefs(settings)
  const colorMode = useColorMode()

  watchEffect(() => {
    const nextTheme = toColorModeTheme(preferences.value.theme)
    if (colorMode.value !== nextTheme) {
      colorMode.value = nextTheme
    }
  })

  watchEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.reducedMotion = preferences.value.reducedMotion
      ? 'true'
      : 'false'
  })
}
