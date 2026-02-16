<script setup lang="ts">
import {
  X,
  ZoomIn,
  ZoomOut,
  Trash2,
  MousePointer2,
  Ban,
} from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'

defineProps<{
  pageNumber: number
  totalPages: number
  isMobile: boolean
  zoom: number
  isRedactMode: boolean
  hasPreviewPage: boolean
  hasSelectedRedaction: boolean
}>()

const emit = defineEmits<{
  close: []
  zoomIn: []
  zoomOut: []
  resetZoom: []
  toggleRedact: []
  deleteSelectedRedactions: []
}>()
</script>

<template>
  <header
    class="flex items-center justify-between px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 shrink-0 z-40 transition-opacity duration-300 antialiased bg-card border-b border-border"
  >
    <div class="flex items-center gap-6 min-w-0 sm:min-w-[200px]">
      <div class="flex flex-col">
        <span class="ui-kicker opacity-70 leading-none mb-1"> Page Preview </span>
        <span class="ui-mono text-sm font-medium text-foreground">
          PAGE {{ pageNumber.toString().padStart(2, '0') }}
          <span class="opacity-40">/ {{ totalPages.toString().padStart(2, '0') }}</span>
        </span>
      </div>
    </div>

    <div v-if="!isMobile" class="flex items-center gap-3">
      <div class="ui-panel-muted rounded-sm p-0.5 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          title="Zoom Out"
          @click="emit('zoomOut')"
          aria-label="Zoom out"
        >
          <ZoomOut class="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          class="h-8 px-3 ui-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          @click="emit('resetZoom')"
        >
          {{ Math.round(zoom * 100) }}%
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          title="Zoom In"
          @click="emit('zoomIn')"
          aria-label="Zoom in"
        >
          <ZoomIn class="w-4 h-4" />
        </Button>
      </div>

      <div class="ui-panel-muted rounded-sm p-0.5 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 px-3 ui-label transition-colors gap-2"
          :class="
            isRedactMode
              ? 'bg-destructive/15 text-destructive hover:bg-destructive/20'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="emit('toggleRedact')"
          :disabled="!hasPreviewPage"
        >
          <component :is="isRedactMode ? Ban : MousePointer2" class="w-3.5 h-3.5" />
          <span>{{ isRedactMode ? 'Done' : 'Redact' }}</span>
        </Button>
      </div>
    </div>
    <div v-else class="flex-1"></div>

    <div class="flex items-center justify-end min-w-0 sm:min-w-[200px] gap-2">
      <Button
        v-if="isRedactMode && hasSelectedRedaction"
        variant="ghost"
        size="icon"
        class="h-10 w-10 text-destructive hover:bg-destructive/10 transition-colors"
        title="Delete Selected Box (Backspace)"
        @click="emit('deleteSelectedRedactions')"
      >
        <Trash2 class="w-5 h-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-transform duration-200 hover:rotate-90"
        aria-label="Close preview"
        @click="emit('close')"
      >
        <X class="w-5 h-5" />
      </Button>
    </div>
  </header>
</template>
