import { computed } from 'vue'
import { useColorMode, usePreferredReducedMotion } from '@vueuse/core'
import { useSettingsStore, type ThemePreference } from '@/domains/workspace/store/settings.store'

export function useThemeToggle() {
  const colorMode = useColorMode()
  const prefersReducedMotion = usePreferredReducedMotion()
  const settings = useSettingsStore()

  const mode = computed(() => settings.preferences.theme)
  const isDark = computed(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return colorMode.value === 'dark'
  })

  const reduceMotion = computed(
    () => settings.preferences.reducedMotion || prefersReducedMotion.value === 'reduce',
  )

  const toggleTheme = (event?: MouseEvent) => {
    const nextTheme: ThemePreference = isDark.value ? 'light' : 'dark'

    if (typeof document === 'undefined') {
      settings.preferences.theme = nextTheme
      return
    }

    if (!document.startViewTransition || reduceMotion.value) {
      settings.preferences.theme = nextTheme
      return
    }

    const x =
      event?.clientX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
    const y =
      event?.clientY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0)

    document.documentElement.style.setProperty('--x', `${x}px`)
    document.documentElement.style.setProperty('--y', `${y}px`)

    document.startViewTransition(() => {
      settings.preferences.theme = nextTheme
    })
  }

  return { mode, isDark, toggleTheme }
}

