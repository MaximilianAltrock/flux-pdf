<script setup lang="ts">
import { RotateCw, RotateCcw, Trash2, Copy, Download, Share2 } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'

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

function handleAction(action: string) {
  haptic('light')
  emit(action as any)
}
</script>

<template>
  <footer
    class="shrink-0 bg-surface border-t border-border"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
  >
    <!-- Selection Mode: Context Actions -->
    <div
      v-if="selectionMode && selectedCount > 0"
      class="h-16 flex items-center justify-around px-2"
    >
      <button
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] text-text active:text-primary transition-colors"
        @click="handleAction('rotateLeft')"
      >
        <RotateCcw class="w-5 h-5" />
        <span class="text-[10px] font-medium">Left</span>
      </button>

      <button
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] text-text active:text-primary transition-colors"
        @click="handleAction('rotateRight')"
      >
        <RotateCw class="w-5 h-5" />
        <span class="text-[10px] font-medium">Right</span>
      </button>

      <button
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] text-text active:text-primary transition-colors"
        @click="handleAction('duplicate')"
      >
        <Copy class="w-5 h-5" />
        <span class="text-[10px] font-medium">Copy</span>
      </button>

      <button
        class="flex flex-col items-center justify-center gap-0.5 p-2 min-w-[60px] text-danger active:text-danger/80 transition-colors"
        @click="handleAction('delete')"
      >
        <Trash2 class="w-5 h-5" />
        <span class="text-[10px] font-medium">Delete</span>
      </button>
    </div>

    <!-- Normal Mode: Export Button -->
    <div v-else class="h-16 flex items-center px-4">
      <button
        v-if="hasPages"
        class="flex-1 h-12 flex items-center justify-center gap-2 bg-primary text-white rounded-xl font-semibold active:bg-primary/90 transition-colors shadow-sm"
        @click="handleAction('export')"
      >
        <component :is="canShareFiles ? Share2 : Download" class="w-5 h-5" />
        <span>{{ canShareFiles ? 'Export & Share' : 'Export PDF' }}</span>
      </button>

      <div v-else class="flex-1 text-center text-text-muted text-sm py-4">
        Add a PDF to get started
      </div>
    </div>
  </footer>
</template>
