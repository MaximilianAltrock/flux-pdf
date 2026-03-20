import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useExportFlowController } from '@/domains/export/ui/useExportFlowController'

function createDocumentStub() {
  return {
    metadata: {
      title: '',
      author: 'Alice',
      subject: '',
      keywords: ['demo'],
    },
    projectTitle: 'Quarterly Report',
    selectedCount: 2,
    selectedIds: new Set(['page-1', 'page-3']),
    contentPages: [
      { id: 'page-1', sourceFileId: 'source-1', sourcePageIndex: 0, rotation: 0 },
      { id: 'page-2', sourceFileId: 'source-1', sourcePageIndex: 1, rotation: 0 },
      { id: 'page-3', sourceFileId: 'source-1', sourcePageIndex: 2, rotation: 0 },
    ],
    contentPageCount: 3,
  }
}

function createActionsStub() {
  return {
    exportJob: ref({
      status: 'idle',
      progress: 0,
      error: null,
    }),
    exportDocument: vi.fn(async (options) => ({
      ok: true as const,
      value: {
        bytes: new Uint8Array([1, 2, 3]),
        filename: options.filename,
        mimeType: 'application/pdf',
        size: 4096,
        originalSize: 8192,
        compressionRatio: 0.5,
      },
    })),
    getSuggestedFilename: vi.fn(() => 'quarterly-report'),
    clearExportError: vi.fn(),
    parsePageRange: vi.fn(() => [0, 1]),
    validatePageRange: vi.fn(() => ({ valid: true })),
  }
}

describe('useExportFlowController', () => {
  it('resets shared export state when opened', async () => {
    const open = ref(false)
    const exportSelected = ref(true)
    const actions = createActionsStub()
    const document = createDocumentStub()

    const scope = effectScope()
    const controller = scope.run(() =>
      useExportFlowController(
        {
          open,
          exportSelected,
          onClose: vi.fn(),
        },
        {
          actions,
          document,
          now: vi.fn(() => 100),
        },
      ),
    )

    open.value = true
    await nextTick()

    expect(actions.getSuggestedFilename).toHaveBeenCalledTimes(1)
    expect(actions.clearExportError).toHaveBeenCalledTimes(1)
    expect(controller?.settings.value.filename).toBe('quarterly-report')
    expect(controller?.settings.value.pageRangeMode).toBe('selected')
    expect(controller?.displayPageCount.value).toBe(2)

    scope.stop()
  })

  it('exports through one shared execution path and reports success stats', async () => {
    const open = ref(true)
    const exportSelected = ref(true)
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const actions = createActionsStub()
    const document = createDocumentStub()
    const now = vi.fn(() => 100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(145)

    const scope = effectScope()
    const controller = scope.run(() =>
      useExportFlowController(
        {
          open,
          exportSelected,
          onClose,
          onSuccess,
        },
        {
          actions,
          document,
          now,
        },
      ),
    )

    await nextTick()
    if (!controller) throw new Error('controller missing')
    controller.isConfigValid.value = true

    await controller.handleExport()

    expect(actions.exportDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'quarterly-report',
        pageRange: '1, 3',
        metadata: expect.objectContaining({
          title: 'Quarterly Report',
        }),
      }),
    )
    expect(controller.exportComplete.value).toBe(true)
    expect(controller.exportStats.value).toEqual({
      filename: 'quarterly-report',
      sizeKB: 4,
      durationMs: 45,
      originalSizeKB: 8,
      compressionRatio: 0.5,
    })
    expect(onSuccess).toHaveBeenCalledWith('quarterly-report', 4, 45)

    scope.stop()
  })

  it('blocks close requests while an export is running', () => {
    const open = ref(true)
    const exportSelected = ref(false)
    const onClose = vi.fn()
    const actions = createActionsStub()
    actions.exportJob.value.status = 'running'

    const scope = effectScope()
    const controller = scope.run(() =>
      useExportFlowController(
        {
          open,
          exportSelected,
          onClose,
        },
        {
          actions,
          document: createDocumentStub(),
        },
      ),
    )

    controller?.handleClose()
    controller?.onOpenChange(false)

    expect(onClose).not.toHaveBeenCalled()

    scope.stop()
  })
})
