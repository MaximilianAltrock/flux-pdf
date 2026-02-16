<script setup lang="ts">
import { RotateCw, Copy, Trash2, Square } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'

defineProps<{
  isRedactMode: boolean
  hasPreviewPage: boolean
}>()

const emit = defineEmits<{
  toggleRedact: []
  rotate: []
  duplicate: []
  delete: []
}>()
</script>

<template>
  <footer
    class="shrink-0 border-t border-border bg-card px-4 py-3"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
  >
    <div class="flex items-center justify-around gap-2">
      <Button
        variant="ghost"
        class="flex-1 h-12 flex flex-col items-center justify-center gap-1"
        :class="isRedactMode ? 'text-destructive bg-destructive/10' : 'text-muted-foreground'"
        :disabled="!hasPreviewPage"
        @click="emit('toggleRedact')"
      >
        <Square class="w-5 h-5" />
        <span class="ui-2xs font-semibold">{{ isRedactMode ? 'Done' : 'Redact' }}</span>
      </Button>

      <Button
        v-if="!isRedactMode"
        variant="ghost"
        class="flex-1 h-12 flex flex-col items-center justify-center gap-1 text-muted-foreground"
        :disabled="!hasPreviewPage"
        @click="emit('rotate')"
      >
        <RotateCw class="w-5 h-5" />
        <span class="ui-2xs font-semibold">Rotate</span>
      </Button>
      <Button
        v-if="!isRedactMode"
        variant="ghost"
        class="flex-1 h-12 flex flex-col items-center justify-center gap-1 text-muted-foreground"
        :disabled="!hasPreviewPage"
        @click="emit('duplicate')"
      >
        <Copy class="w-5 h-5" />
        <span class="ui-2xs font-semibold">Duplicate</span>
      </Button>

      <Button
        variant="ghost"
        class="flex-1 h-12 flex flex-col items-center justify-center gap-1 text-destructive"
        :disabled="!hasPreviewPage"
        @click="emit('delete')"
      >
        <Trash2 class="w-5 h-5" />
        <span class="ui-2xs font-semibold">Delete</span>
      </Button>
    </div>
  </footer>
</template>
