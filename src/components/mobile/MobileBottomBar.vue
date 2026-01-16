<script setup lang="ts">
import { RotateCw, RotateCcw, Trash2, Copy, Download, Share2 } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'

defineProps<{
  selectionMode: boolean
  selectedCount: number
  hasPages: boolean
}>()

const emit = defineEmits<{
  rotateLeft: []
  rotateRight: []
  delete: []
  duplicate: []
  export: []
}>()

const { haptic, canShareFiles } = useMobile()

type BottomBarEvent = 'rotateLeft' | 'rotateRight' | 'delete' | 'duplicate' | 'export'

function handleAction(action: BottomBarEvent) {
  haptic('light')

  switch (action) {
    case 'rotateLeft':
      emit('rotateLeft')
      break
    case 'rotateRight':
      emit('rotateRight')
      break
    case 'delete':
      emit('delete')
      break
    case 'duplicate':
      emit('duplicate')
      break
    case 'export':
      emit('export')
      break
  }
}
</script>

<template>
  <footer
    class="shrink-0 bg-card border-t border-border"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
  >
    <!-- Selection Mode: Context Actions -->
    <ButtonGroup
      v-if="selectionMode && selectedCount > 0"
      class="h-16 w-full items-center justify-around px-2 gap-2 [&_[data-slot=button]]:rounded-xl"
    >
      <Button
        variant="ghost"
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] h-auto text-foreground active:text-primary transition-colors"
        @click="handleAction('rotateLeft')"
      >
        <RotateCcw class="w-5 h-5" />
        <span class="text-xs font-medium">Left</span>
      </Button>

      <Button
        variant="ghost"
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] h-auto text-foreground active:text-primary transition-colors"
        @click="handleAction('rotateRight')"
      >
        <RotateCw class="w-5 h-5" />
        <span class="text-xs font-medium">Right</span>
      </Button>

      <Button
        variant="ghost"
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] h-auto text-foreground active:text-primary transition-colors"
        @click="handleAction('duplicate')"
      >
        <Copy class="w-5 h-5" />
        <span class="text-xs font-medium">Copy</span>
      </Button>

      <Button
        variant="ghost"
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] h-auto text-destructive active:text-destructive/80 transition-colors"
        @click="handleAction('delete')"
      >
        <Trash2 class="w-5 h-5" />
        <span class="text-xs font-medium">Delete</span>
      </Button>
    </ButtonGroup>

    <!-- Normal Mode: Export Button -->
    <div v-else class="h-16 flex items-center px-4">
      <Button
        v-if="hasPages"
        class="flex-1 h-12 flex items-center justify-center gap-2 font-semibold text-sm shadow-sm"
        @click="handleAction('export')"
      >
        <component :is="canShareFiles ? Share2 : Download" class="w-5 h-5" />
        <span>{{ canShareFiles ? 'Export & Share' : 'Export PDF' }}</span>
      </Button>

      <div v-else class="flex-1 text-center text-muted-foreground text-sm py-4">
        Add a PDF to get started
      </div>
    </div>
  </footer>
</template>


