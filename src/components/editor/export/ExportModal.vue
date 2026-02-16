<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import { Download, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogScrollContent,
} from '@/components/ui/dialog'
import { useMobile } from '@/composables'
import type { ExportOptions } from '@/domains/document/application/document.service'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useDocumentStore } from '@/stores/document'

// Sub-components
import ExportConfiguration, { type ExportSettings } from './ExportConfiguration.vue'
import ExportStatus, { type ExportStats } from './ExportStatus.vue'

const props = defineProps<{
  open: boolean
  exportSelected?: boolean
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()

const emit = defineEmits<{
  close: []
  success: [filename: string, sizeKB: number, durationMs: number]
}>()

const exportJob = actions.exportJob
const { getSuggestedFilename, clearExportError } = actions

const isExporting = computed(() => exportJob.value.status === 'running')
const exportProgress = computed(() => exportJob.value.progress)
const exportError = computed(() => exportJob.value.error)

const { isMobile, onBackButton } = useMobile()

// Export state
const exportComplete = shallowRef(false)
const exportStats = ref<ExportStats | null>(null)
const isConfigValid = shallowRef(false)

// Settings state
const settings = ref<ExportSettings>({
  filename: '',
  pageRangeMode: 'all',
  customPageRange: '',
  compress: false,
  compressionQuality: 'none',
  outlineInclude: true,
  outlineFlatten: false,
  outlineExpandAll: false,
})

// Reset state when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      settings.value = {
        filename: getSuggestedFilename(),
        pageRangeMode: props.exportSelected && document.selectedCount > 0 ? 'selected' : 'all',
        customPageRange: '',
        compress: false,
        compressionQuality: 'none',
        outlineInclude: true,
        outlineFlatten: false,
        outlineExpandAll: false,
      }

      exportComplete.value = false
      exportStats.value = null
      clearExportError()
    }
  },
)

async function handleExport() {
  const startTime = performance.now()

  try {
    const title = document.metadata.title?.trim() || document.projectTitle?.trim()
    const options: ExportOptions = {
      filename: settings.value.filename.trim(),
      compress: settings.value.compress,
      compressionQuality: settings.value.compressionQuality,
      outline: {
        include: settings.value.outlineInclude,
        flatten: settings.value.outlineFlatten,
        expandAll: settings.value.outlineExpandAll,
      },
      metadata: {
        ...document.metadata,
        keywords: [...document.metadata.keywords],
        title: title ?? document.metadata.title,
      },
    }

    if (settings.value.pageRangeMode === 'selected') {
      const selectedIndices = document.contentPages
        .map((p, i) => (document.selectedIds.has(p.id) ? i + 1 : null))
        .filter((i): i is number => i !== null)
      options.pageRange = selectedIndices.join(', ')
    } else if (settings.value.pageRangeMode === 'custom') {
      options.pageRange = settings.value.customPageRange
    }

    const result = await actions.exportDocument(options)
    if (!result.ok) return

    const endTime = performance.now()
    const durationMs = Math.round(endTime - startTime)

    exportStats.value = {
      filename: result.value.filename,
      sizeKB: Math.round(result.value.size / 1024),
      durationMs,
      originalSizeKB: result.value.originalSize
        ? Math.round(result.value.originalSize / 1024)
        : undefined,
      compressionRatio: result.value.compressionRatio,
    }

    exportComplete.value = true
    emit(
      'success',
      exportStats.value.filename,
      exportStats.value.sizeKB,
      exportStats.value.durationMs,
    )
  } catch {
    // Error is handled in composable
  }
}

function handleClose() {
  if (!isExporting.value) {
    emit('close')
  }
}

function onOpenChange(val: boolean) {
  if (!val) {
    handleClose()
  }
}

function resetError() {
  clearExportError()
}

if (isMobile.value) {
  onBackButton(
    computed(() => props.open),
    () => emit('close'),
  )
}

// Computed page count for button label (simplified logic for display)
const displayPageCount = computed(() => {
  // Use a heuristic or just a "pages" string if calculation is expensive/duplicate
  // Ideally ExportConfiguration would emit this too, or we duplicate strict logic.
  // We can just rely on basic heuristic here as button text isn't critical validation
  if (settings.value.pageRangeMode === 'all') return document.contentPageCount
  if (settings.value.pageRangeMode === 'selected') return document.selectedCount
  return 'Custom'
})
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
            @update:valid="isConfigValid = $event"
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
