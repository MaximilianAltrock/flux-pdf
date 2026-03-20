<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useMobile } from '@/shared/composables/useMobile'
import MobileExportSheetView from '@/domains/export/ui/components/mobile/MobileExportSheetView.vue'
import { useExportFlowController } from '@/domains/export/ui/useExportFlowController'

const props = defineProps<{
  open: boolean
  exportSelected?: boolean
}>()

const emit = defineEmits<{
  close: []
  success: [filename: string, sizeKB: number, durationMs: number]
}>()

const { onBackButton } = useMobile()
const {
  settings,
  isConfigValid,
  exportComplete,
  exportStats,
  isExporting,
  exportProgress,
  exportError,
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

function handleSettingsUpdate(value: typeof settings.value) {
  settings.value = value
}

function handleValidUpdate(value: boolean) {
  isConfigValid.value = value
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
