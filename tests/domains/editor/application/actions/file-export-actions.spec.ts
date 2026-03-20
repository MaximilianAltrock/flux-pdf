import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createFileExportActions } from '@/domains/editor/application/actions/file-export-actions'
import type { ExportService } from '@/domains/export/application/export-service'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { ExportOperationState } from '@/domains/export/session/export-operation.state'

function createHarness(options?: { isMobile?: boolean }) {
  const store = {
    contentPages: [],
    contentPageCount: 0,
    projectTitle: 'Project',
  } as unknown as DocumentState

  const ui = {
    setLoading: vi.fn(),
  } as unknown as Pick<EditorUiState, 'setLoading'>

  const exportState = {
    openExportModal: vi.fn(),
  } as unknown as Pick<ExportOperationState, 'openExportModal'>

  const toast = {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }

  const blurActiveElement = vi.fn()
  const haptic = vi.fn()
  const shareFile = vi.fn(async () => ({ shared: false, downloaded: false }))
  const services = {
    generateRawPdf: vi.fn<ExportService['generateRawPdf']>(async () => ({
      ok: true,
      value: new Uint8Array(),
    })),
    exportDocument: vi.fn<ExportService['exportDocument']>(async () => ({
      ok: false,
      error: { message: 'not-used' },
    })),
    parsePageRange: vi.fn<ExportService['parsePageRange']>(() => []),
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
    blurActiveElement,
    services,
  })

  return { actions, services, exportState, toast, haptic }
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
})
