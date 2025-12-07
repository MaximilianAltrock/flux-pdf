import { ref, computed } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'flux_theme_preference'

// Shared state across all components
const theme = ref<Theme>('dark')
const isDark = ref(true)
let initialized = false

/**
 * Initialize theme immediately (called once)
 */
function initTheme() {
  if (initialized) return
  initialized = true

  // Check if light-theme was already applied by flash-prevention script
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('light-theme')) {
      isDark.value = false
      theme.value = 'light'
    }

    // Check stored preference
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      theme.value = stored
      applyTheme()
    }
  }
}

/**
 * Apply the current theme to the document
 */
function applyTheme() {
  if (typeof document === 'undefined') return

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  if (theme.value === 'system') {
    isDark.value = prefersDark
  } else {
    isDark.value = theme.value === 'dark'
  }

  console.log('[Theme] Applying theme:', theme.value, 'isDark:', isDark.value)

  // Update html element class (light-theme class for light mode)
  if (isDark.value) {
    document.documentElement.classList.remove('light-theme')
    console.log('[Theme] Removed light-theme class from html')
  } else {
    document.documentElement.classList.add('light-theme')
    console.log('[Theme] Added light-theme class to html')
  }
}

/**
 * Composable for managing theme (light/dark mode)
 * Uses body.light-theme class to toggle themes
 */
export function useTheme() {
  // Initialize on first use
  initTheme()

  // Set theme and persist
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme()
  }

  // Toggle between light and dark (not system)
  function toggleTheme() {
    console.log('[Theme] Toggle called, current isDark:', isDark.value)
    setTheme(isDark.value ? 'light' : 'dark')
  }

  // Computed for display
  const themeLabel = computed(() => {
    if (theme.value === 'system') return 'System'
    return isDark.value ? 'Dark' : 'Light'
  })

  return {
    theme,
    isDark,
    themeLabel,
    setTheme,
    toggleTheme
  }
}
