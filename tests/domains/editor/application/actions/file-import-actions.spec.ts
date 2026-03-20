import { describe, expect, it, vi } from 'vitest'
import { createFileImportActions } from '@/domains/editor/application/actions/file-import-actions'
import type { ImportService } from '@/domains/import/application/import-service'

function createHarness() {
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  }

  const openFileDialog = vi.fn()
  const clearFileInput = vi.fn()
  const importFiles = vi.fn<ImportService['importFiles']>(async () => ({
    ok: true,
    value: {
      results: [],
      successes: [{ success: true }],
      errors: [],
      totalPages: 1,
    },
  }))

  const actions = createFileImportActions({
    toast,
    openFileDialog,
    clearFileInput,
    services: {
      importFiles,
    },
  })

  return { actions, importFiles, toast, openFileDialog, clearFileInput }
}

describe('file/import action module', () => {
  it('imports selected files through the import service and reports success', async () => {
    const harness = createHarness()
    const files = [] as unknown as FileList

    await harness.actions.handleFilesSelected(files)

    expect(harness.importFiles).toHaveBeenCalledWith(files, { addPages: true })
    expect(harness.toast.success).toHaveBeenCalled()
  })

  it('opens the shared file picker for mobile add flow', () => {
    const harness = createHarness()

    harness.actions.handleMobileAddFiles()

    expect(harness.openFileDialog).toHaveBeenCalled()
  })
})
