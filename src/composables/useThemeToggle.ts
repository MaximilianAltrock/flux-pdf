import { useColorMode, usePreferredReducedMotion } from '@vueuse/core'

export function useThemeToggle() {
  const mode = useColorMode()
  const prefersReducedMotion = usePreferredReducedMotion()

  const toggleTheme = (event?: MouseEvent) => {
    const newMode = mode.value === 'dark' ? 'light' : 'dark'

    if (typeof document === 'undefined') {
      mode.value = newMode
      return
    }

  if (!document.startViewTransition || prefersReducedMotion.value === 'reduce') {
    mode.value = newMode
    return
  }

    const x =
      event?.clientX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
    const y =
      event?.clientY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0)

    document.documentElement.style.setProperty('--x', `${x}px`)
    document.documentElement.style.setProperty('--y', `${y}px`)

    document.startViewTransition(() => {
      mode.value = newMode
    })
  }

  return { mode, toggleTheme }
}
