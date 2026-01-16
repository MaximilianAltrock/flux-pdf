<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useThemeToggle } from '@/composables/useThemeToggle'

const { mode, toggleTheme } = useThemeToggle()
</script>

<template>
  <Button variant="ghost" size="icon-sm" @click="toggleTheme">
    <Sun v-if="mode === 'light'" class="h-4 w-4" />
    <Moon v-else class="h-4 w-4" />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
