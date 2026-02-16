<script setup lang="ts">
import { Clock, FilePlus } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'

const emit = defineEmits<{
  dashboard: []
  newProject: []
}>()
</script>

<template>
  <div class="p-4 border-t border-border bg-card">
    <div class="grid gap-2">
      <Button
        variant="outline"
        class="w-full gap-3 h-12 text-sm font-semibold"
        @click="emit('dashboard')"
      >
        <Clock class="w-5 h-5" />
        Dashboard
      </Button>
      <Button class="w-full gap-3 h-12 text-sm font-semibold" @click="emit('newProject')">
        <FilePlus class="w-5 h-5" />
        New Project
      </Button>
    </div>
    <div class="mt-4 text-center ui-kicker opacity-70">
      FluxPDF Editor
    </div>
  </div>
</template>
