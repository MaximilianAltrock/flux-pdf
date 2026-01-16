<script setup lang="ts">
import { RotateCw, RotateCcw, Copy, Trash2, Download } from 'lucide-vue-next'
import { useMobile } from '@/composables/useMobile'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

defineProps<{
  open: boolean
  selectedCount: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  rotateLeft: []
  rotateRight: []
  duplicate: []
  delete: []
  exportSelected: []
}>()

const { haptic } = useMobile()

function handleAction(
  action: 'rotateLeft' | 'rotateRight' | 'duplicate' | 'delete' | 'exportSelected',
) {
  haptic('medium')
  switch (action) {
    case 'rotateLeft':
      emit('rotateLeft')
      break
    case 'rotateRight':
      emit('rotateRight')
      break
    case 'duplicate':
      emit('duplicate')
      break
    case 'delete':
      emit('delete')
      break
    case 'exportSelected':
      emit('exportSelected')
      break
  }
  emit('update:open', false)
}
</script>

<template>
  <Drawer :open="open" @update:open="(val) => emit('update:open', val)">
    <DrawerContent>
      <div class="mx-auto w-full max-w-sm">
        <DrawerHeader>
          <DrawerTitle class="text-center">
            {{ selectedCount }} page{{ selectedCount > 1 ? 's' : '' }} selected
          </DrawerTitle>
        </DrawerHeader>

        <!-- Actions Grid -->
        <div class="grid grid-cols-4 gap-2 px-4 py-4">
          <Button
            variant="ghost"
            class="flex flex-col items-center gap-2 p-3 h-auto rounded-md hover:bg-muted/20 active:bg-muted/30 transition-colors"
            @click="handleAction('rotateLeft')"
          >
            <div class="w-10 h-10 rounded-md bg-muted/20 border border-border flex items-center justify-center">
              <RotateCcw class="w-5 h-5 text-primary" />
            </div>
            <span class="text-xs font-medium">Left</span>
          </Button>

          <Button
            variant="ghost"
            class="flex flex-col items-center gap-2 p-3 h-auto rounded-md hover:bg-muted/20 active:bg-muted/30 transition-colors"
            @click="handleAction('rotateRight')"
          >
            <div class="w-10 h-10 rounded-md bg-muted/20 border border-border flex items-center justify-center">
              <RotateCw class="w-5 h-5 text-primary" />
            </div>
            <span class="text-xs font-medium">Right</span>
          </Button>

          <Button
            variant="ghost"
            class="flex flex-col items-center gap-2 p-3 h-auto rounded-md hover:bg-muted/20 active:bg-muted/30 transition-colors"
            @click="handleAction('duplicate')"
          >
            <div class="w-10 h-10 rounded-md bg-muted/20 border border-border flex items-center justify-center">
              <Copy class="w-5 h-5 text-primary" />
            </div>
            <span class="text-xs font-medium">Copy</span>
          </Button>

          <Button
            variant="ghost"
            class="flex flex-col items-center gap-2 p-3 h-auto rounded-md hover:bg-muted/20 active:bg-muted/30 transition-colors"
            @click="handleAction('exportSelected')"
          >
            <div class="w-10 h-10 rounded-md bg-muted/20 border border-border flex items-center justify-center">
              <Download class="w-5 h-5 text-primary" />
            </div>
            <span class="text-xs font-medium">Export</span>
          </Button>
        </div>

        <!-- Delete (separate, danger) -->
        <div class="px-4 pb-4">
          <Button
            variant="destructive"
            class="w-full h-12 flex items-center justify-center gap-2 py-3 text-sm font-semibold shadow-none"
            @click="handleAction('delete')"
          >
            <Trash2 class="w-5 h-5" />
            <span>Delete {{ selectedCount > 1 ? 'Pages' : 'Page' }}</span>
          </Button>
        </div>

        <DrawerFooter class="pt-0">
          <!-- Safe Area -->
          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>
