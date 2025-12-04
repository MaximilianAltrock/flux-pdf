<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { theme, isDark, setTheme } = useTheme()

function cycleTheme() {
  if (theme.value === 'light') {
    setTheme('dark')
  } else if (theme.value === 'dark') {
    setTheme('system')
  } else {
    setTheme('light')
  }
}
</script>

<template>
  <button
    class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
    :title="`Theme: ${theme} (click to change)`"
    @click="cycleTheme"
  >
    <Sun v-if="theme === 'light'" class="w-5 h-5 text-amber-500" />
    <Moon v-else-if="theme === 'dark'" class="w-5 h-5 text-indigo-400" />
    <Monitor v-else class="w-5 h-5 text-gray-500 dark:text-gray-400" />
  </button>
</template>
