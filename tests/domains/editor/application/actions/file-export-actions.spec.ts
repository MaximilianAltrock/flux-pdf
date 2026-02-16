import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createFileExportActions } from '@/domains/editor/application/actions/file-export-actions'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { useExportStore } from '@/domains/export/store/export.store'
import type { DocumentService } from '@/domains/document/application/document.service'

function createHarness(options?: { isMobile?: boolean }) {
  const store = {
    contentPages: [],
    contentPageCount: 0,
    projectTitle: 'Project',
  } as unknown as ReturnType<typeof useDocumentStore>

  const ui = {
    setLoading: vi.fn(),
  } as unknown as Pick<ReturnType<typeof useUiStore>, 'setLoading'>

  const exportState = {
    openExportModal: vi.fn(),
  } as unknown as Pick<ReturnType<typeof useExportStore>, 'openExportModal'>

  const toast = {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }

  const openFileDialog = vi.fn()
  const clearFileInput = vi.fn()
  const blurActiveElement = vi.fn()
  const haptic = vi.fn()
  const shareFile = vi.fn(async () => ({ shared: false, downloaded: false }))
  const importFiles = vi.fn<
    DocumentService['importFiles']
  >(async () => ({
    ok: true,
    value: {
      results: [],
      successes: [{ success: true }],
      errors: [],
      totalPages: 1,
    },
  }))
  const services = {
    importFiles,
    generateRawPdf: vi.fn<DocumentService['generateRawPdf']>(async () => ({
      ok: true,
      value: new Uint8Array(),
    })),
    exportDocument: vi.fn<DocumentService['exportDocument']>(async () => ({
      ok: false,
      error: { message: 'not-used' },
    })),
    parsePageRange: vi.fn<DocumentService['parsePageRange']>(() => []),
  }

  const actions = createFileExportActions({
    store,
    ui,
    exportState,
    toast,
    mobile: {
      isMobile: ref(options?.isMobile ?? false),
      canShareFiles: ref(false),
      haptic,
      shareFile,
    },
    openFileDialog,
    clearFileInput,
    blurActiveElement,
    services,
  })

  return { actions, services, exportState, toast, haptic, openFileDialog }
}

describe('file/export action module', () => {
  it('opens export options for selected pages and triggers mobile haptic', () => {
    const harness = createHarness({ isMobile: true })

    harness.actions.handleExportSelected()

    expect(harness.haptic).toHaveBeenCalledWith('light')
    expect(harness.exportState.openExportModal).toHaveBeenCalledWith(true)
  })

  it('opens export options in desktop export flow', async () => {
    const harness = createHarness({ isMobile: false })

    await harness.actions.handleExport()

    expect(harness.exportState.openExportModal).toHaveBeenCalledWith(false)
  })

  it('imports selected files through document service and reports success', async () => {
    const harness = createHarness()
    const files = [] as unknown as FileList

    await harness.actions.handleFilesSelected(files)

    expect(harness.services.importFiles).toHaveBeenCalledWith(files, { addPages: true })
    expect(harness.toast.success).toHaveBeenCalled()
  })
})
