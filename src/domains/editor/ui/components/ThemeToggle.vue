<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import { useThemeToggle } from '@/domains/workspace/application/useThemeToggle'

const { isDark, toggleTheme } = useThemeToggle()
</script>

<template>
  <Button variant="ghost" size="icon-sm" @click="toggleTheme">
    <Moon v-if="isDark" class="h-4 w-4" />
    <Sun v-else class="h-4 w-4" />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
