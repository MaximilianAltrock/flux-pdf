import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import type { ExportOptions } from '@/domains/export/domain/export'
import {
  useDocumentActionsContext,
  type DocumentActions,
} from '@/domains/editor/application/useDocumentActions'
import { useProjectSession } from '@/domains/project-session/session'
import type { ProjectSession } from '@/domains/project-session/domain/project-session'
import type { ExportSettings, ExportStats } from '@/domains/export/ui/export-flow.types'

type ExportActions = Pick<
  DocumentActions,
  | 'exportJob'
  | 'exportDocument'
  | 'getSuggestedFilename'
  | 'clearExportError'
  | 'parsePageRange'
  | 'validatePageRange'
>

type ExportDocumentState = Pick<
  ProjectSession['document'],
  | 'metadata'
  | 'projectTitle'
  | 'selectedCount'
  | 'selectedIds'
  | 'contentPages'
  | 'contentPageCount'
>

export interface UseExportFlowControllerOptions {
  open: Ref<boolean>
  exportSelected: Ref<boolean | undefined>
  onClose: () => void
  onSuccess?: (filename: string, sizeKB: number, durationMs: number) => void
}

export interface UseExportFlowControllerDeps {
  actions?: ExportActions
  document?: ExportDocumentState
  now?: () => number
}

function createInitialExportSettings(options: {
  filename: string
  exportSelected: boolean
  selectedCount: number
}): ExportSettings {
  return {
    filename: options.filename,
    pageRangeMode: options.exportSelected && options.selectedCount > 0 ? 'selected' : 'all',
    customPageRange: '',
    compress: false,
    compressionQuality: 'none',
    outlineInclude: true,
    outlineFlatten: false,
    outlineExpandAll: false,
  }
}

export function useExportFlowController(
  options: UseExportFlowControllerOptions,
  deps: UseExportFlowControllerDeps = {},
) {
  const actions = deps.actions ?? useDocumentActionsContext()
  const document = deps.document ?? useProjectSession().document
  const now = deps.now ?? (() => performance.now())

  const exportComplete = shallowRef(false)
  const exportStats = ref<ExportStats | null>(null)
  const isConfigValid = shallowRef(false)
  const settings = ref<ExportSettings>(
    createInitialExportSettings({
      filename: '',
      exportSelected: false,
      selectedCount: 0,
    }),
  )

  const exportJob = actions.exportJob
  const isExporting = computed(() => exportJob.value.status === 'running')
  const exportProgress = computed(() => exportJob.value.progress)
  const exportError = computed(() => exportJob.value.error)

  const displayPageCount = computed(() => {
    if (settings.value.pageRangeMode === 'all') return document.contentPageCount
    if (settings.value.pageRangeMode === 'selected') return document.selectedCount

    const customRange = settings.value.customPageRange.trim()
    if (!customRange) return 'Custom'

    const validation = actions.validatePageRange(customRange, document.contentPageCount)
    if (!validation.valid) return 'Custom'

    return actions.parsePageRange(customRange, document.contentPageCount).length
  })

  watch(
    options.open,
    (isOpen) => {
      if (!isOpen) return

      settings.value = createInitialExportSettings({
        filename: actions.getSuggestedFilename(),
        exportSelected: Boolean(options.exportSelected.value),
        selectedCount: document.selectedCount,
      })
      exportComplete.value = false
      exportStats.value = null
      isConfigValid.value = false
      actions.clearExportError()
    },
    { immediate: true },
  )

  async function handleExport() {
    const startTime = now()

    try {
      const title = document.metadata.title?.trim() || document.projectTitle?.trim()
      const exportOptions: ExportOptions = {
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
          .map((page, index) => (document.selectedIds.has(page.id) ? index + 1 : null))
          .filter((index): index is number => index !== null)
        exportOptions.pageRange = selectedIndices.join(', ')
      } else if (settings.value.pageRangeMode === 'custom') {
        exportOptions.pageRange = settings.value.customPageRange
      }

      const result = await actions.exportDocument(exportOptions)
      if (!result.ok) return

      const durationMs = Math.round(now() - startTime)
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
      options.onSuccess?.(
        exportStats.value.filename,
        exportStats.value.sizeKB,
        exportStats.value.durationMs,
      )
    } catch {
      // Error state is already written by the action context.
    }
  }

  function handleClose() {
    if (!isExporting.value) {
      options.onClose()
    }
  }

  function onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      handleClose()
    }
  }

  function resetError() {
    actions.clearExportError()
  }

  return {
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
  }
}
