<script setup lang="ts">
import { Button } from '@/shared/components/ui/button'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  cancel: []
}>()
</script>

<template>
  <div v-if="visible" class="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
    <div
      class="pointer-events-auto flex items-center gap-4 rounded-md border border-primary/30 bg-background/95 px-4 py-2 shadow-sm"
    >
      <div>
        <p class="text-sm font-semibold text-foreground">Outline targeting mode</p>
        <p class="text-xs text-muted-foreground">
          Click a page to set the target. Press Esc to cancel.
        </p>
      </div>
      <Button variant="ghost" size="sm" class="h-7 px-2" @click="emit('cancel')">Cancel</Button>
    </div>
  </div>
</template>
