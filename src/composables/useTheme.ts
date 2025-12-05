import { ref, onMounted } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>('system')
const isDark = ref(false)

const STORAGE_KEY = 'fluxpdf-theme'

/**
 * Composable for managing theme (light/dark mode)
 */
export function useTheme() {
  // Initialize from localStorage
  function initTheme() {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      theme.value = stored
    }
    applyTheme()
  }

  // Apply the current theme to the document
  function applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (theme.value === 'system') {
      isDark.value = prefersDark
    } else {
      isDark.value = theme.value === 'dark'
    }

    // Update document class
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Set theme and persist
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme()
  }

  // Toggle between light and dark (not system)
  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  // Watch for system theme changes
  onMounted(() => {
    initTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme.value === 'system') {
        applyTheme()
      }
    }

    mediaQuery.addEventListener('change', handleChange)
  })

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  }
}
