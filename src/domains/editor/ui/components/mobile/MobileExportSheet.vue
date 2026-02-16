<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import { useMobile } from '@/shared/composables/useMobile'
import type { ExportOptions } from '@/domains/document/application/document.service'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'
import type { ExportSettings } from '@/domains/editor/ui/components/export/ExportConfiguration.vue'
import type { ExportStats } from '@/domains/editor/ui/components/export/ExportStatus.vue'
import MobileExportSheetView from '@/domains/editor/ui/components/mobile/export/MobileExportSheetView.vue'

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

function handleSettingsUpdate(nextSettings: ExportSettings) {
  settings.value = nextSettings
}

function handleValidUpdate(value: boolean) {
  isConfigValid.value = value
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
  <MobileExportSheetView
    :open="props.open"
    :is-exporting="isExporting"
    :export-progress="exportProgress"
    :export-error="exportError"
    :export-complete="exportComplete"
    :export-stats="exportStats"
    :settings="settings"
    :is-config-valid="isConfigValid"
    @update:open="onOpenChange"
    @close="handleClose"
    @export="handleExport"
    @update:settings="handleSettingsUpdate"
    @update:valid="handleValidUpdate"
    @retry="resetError"
  />
</template>

