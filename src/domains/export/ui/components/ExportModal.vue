<script setup lang="ts">
import { toRef } from 'vue'
import { Download, X } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogScrollContent,
} from '@/shared/components/ui/dialog'

// Sub-components
import ExportConfiguration from './ExportConfiguration.vue'
import ExportStatus from './ExportStatus.vue'
import { useExportFlowController } from '@/domains/export/ui/useExportFlowController'

const props = defineProps<{
  open: boolean
  exportSelected?: boolean
}>()

const emit = defineEmits<{
  close: []
  success: [filename: string, sizeKB: number, durationMs: number]
}>()
const {
  settings,
  isConfigValid,
  exportComplete,
  exportStats,
  isExporting,
  exportProgress,
  exportError,
  displayPageCount,
  handleExport,
  handleClose,
  onOpenChange,
  resetError,
} = useExportFlowController({
  open: toRef(props, 'open'),
  exportSelected: toRef(props, 'exportSelected'),
  onClose: () => emit('close'),
  onSuccess: (filename, sizeKB, durationMs) => emit('success', filename, sizeKB, durationMs),
})

function handleValidUpdate(value: boolean) {
  isConfigValid.value = value
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogScrollContent class="sm:max-w-xl p-0 overflow-hidden">
      <DialogHeader
        class="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0 space-y-0 flex-row z-50"
      >
        <div class="flex flex-col">
          <DialogTitle class="text-sm font-semibold flex items-center gap-2">
            Export PDF
          </DialogTitle>
          <DialogDescription class="sr-only">
            Configure export settings and generate the PDF.
          </DialogDescription>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 hover:rotate-90"
          :disabled="isExporting"
          @click="handleClose"
          aria-label="Close export dialog"
        >
          <X class="w-4 h-4" />
        </Button>
      </DialogHeader>

      <div class="px-6 py-6 pb-2">
        <div class="space-y-6">
          <ExportStatus
            v-if="isExporting || exportComplete || exportError"
            :is-exporting="isExporting"
            :progress="exportProgress"
            :error="exportError"
            :complete="exportComplete"
            :stats="exportStats"
            @retry="resetError"
          />

          <ExportConfiguration
            v-else
            v-model:settings="settings"
            @update:valid="handleValidUpdate"
          />
        </div>
      </div>

      <DialogFooter
        class="p-4 border-t border-border bg-card flex items-center justify-end gap-3 shrink-0 z-50"
      >
        <Button
          v-if="!exportComplete && !exportError"
          variant="ghost"
          class="h-9 px-4 ui-label hover:bg-muted/60 transition-colors"
          :disabled="isExporting"
          @click="handleClose"
        >
          Cancel
        </Button>

        <Button
          v-if="exportComplete"
          class="h-9 px-6 text-xs font-semibold shadow-sm"
          @click="handleClose"
        >
          Close
        </Button>

        <Button
          v-else-if="!exportError"
          :disabled="!isConfigValid || isExporting"
          class="h-9 px-6 text-xs font-semibold shadow-sm transition-transform active:scale-95"
          @click="handleExport"
        >
          <Download class="w-3.5 h-3.5 mr-2" />
          Export
          <span v-if="typeof displayPageCount === 'number'">({{ displayPageCount }})</span>
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
