<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'
import { useColorMode } from '@vueuse/core'
import { Button } from '@/components/ui/button'

const mode = useColorMode()

const toggleTheme = (event: MouseEvent) => {
  const { clientX: x, clientY: y } = event
  const newMode = mode.value === 'dark' ? 'light' : 'dark'

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!document.startViewTransition || prefersReducedMotion) {
    mode.value = newMode
    return
  }

  document.documentElement.style.setProperty('--x', `${x}px`)
  document.documentElement.style.setProperty('--y', `${y}px`)

  document.startViewTransition(() => {
    mode.value = newMode
  })
}
</script>

<template>
  <Button variant="ghost" size="icon-sm" @click="toggleTheme">
    <Sun v-if="mode === 'light'" class="h-4 w-4" />
    <Moon v-else class="h-4 w-4" />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
