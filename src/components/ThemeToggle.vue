<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import { useColorMode } from '@vueuse/core'

const mode = useColorMode()

const cycleTheme = () => {
  if (mode.value === 'auto') {
    mode.value = 'light'
  } else if (mode.value === 'light') {
    mode.value = 'dark'
  } else {
    mode.value = 'auto'
  }
}
</script>

<template>
  <button
    class="p-2 rounded-lg transition-colors hover:bg-muted/20"
    :title="`Theme: ${mode} (click to change)`"
    @click="cycleTheme"
  >
    <Sun v-if="mode === 'light'" class="w-5 h-5 text-amber-500" />
    <Moon v-else-if="mode === 'dark'" class="w-5 h-5 text-indigo-400" />
    <Monitor v-else class="w-5 h-5 text-muted-foreground" />
  </button>
</template>

