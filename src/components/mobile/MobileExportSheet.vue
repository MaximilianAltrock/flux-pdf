<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useMobile } from '@/composables'
import type { ExportOptions } from '@/services/documentService'
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useDocumentStore } from '@/stores/document'
import ExportConfiguration, { type ExportSettings } from '@/components/export/ExportConfiguration.vue'
import ExportStatus, { type ExportStats } from '@/components/export/ExportStatus.vue'

const props = defineProps<{
  open: boolean
  exportSelected?: boolean
}>()

const emit = defineEmits<{
  close: []
  success: [filename: string, sizeKB: number, durationMs: number]
}>()

const actions = useDocumentActionsContext()
const document = useDocumentStore()
const exportJob = actions.exportJob
const { getSuggestedFilename, clearExportError } = actions

const isExporting = computed(() => exportJob.value.status === 'running')
const exportProgress = computed(() => exportJob.value.progress)
const exportError = computed(() => exportJob.value.error)

const { onBackButton } = useMobile()

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

onBackButton(
  computed(() => props.open),
  handleClose,
)
</script>

<template>
  <Drawer :open="open" @update:open="onOpenChange">
    <DrawerContent class="h-[80vh]">
      <div class="mx-auto w-full max-w-sm flex flex-col h-full">
        <DrawerHeader>
          <DrawerTitle class="text-center">Export PDF</DrawerTitle>
          <DrawerDescription class="sr-only">
            Configure export settings and generate the PDF.
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea class="flex-1 min-h-0">
          <div class="px-4 pb-4 space-y-6">
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
        </ScrollArea>

        <DrawerFooter class="pt-0">
          <div class="px-4 pb-4 flex items-center gap-3">
            <Button
              v-if="!exportComplete && !exportError"
              variant="ghost"
              class="flex-1 h-11 text-sm font-semibold"
              :disabled="isExporting"
              @click="handleClose"
            >
              Cancel
            </Button>

            <Button
              v-if="exportComplete || exportError"
              class="flex-1 h-11 text-sm font-semibold"
              :disabled="isExporting"
              @click="handleClose"
            >
              Close
            </Button>

            <Button
              v-else
              :disabled="!isConfigValid || isExporting"
              class="flex-1 h-11 text-sm font-semibold"
              @click="handleExport"
            >
              <Download class="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div style="height: env(safe-area-inset-bottom, 0px)" />
        </DrawerFooter>
      </div>
    </DrawerContent>
  </Drawer>
</template>
