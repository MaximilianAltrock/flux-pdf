import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocumentExportService } from '@/domains/export/application/document-export.service'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { PdfRepository } from '@/shared/infrastructure/pdf.repository'

const compressionRuntime = vi.hoisted(() => ({
  compressPdf: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('@/domains/export/application/usePdfCompression', () => ({
  usePdfCompression: vi.fn(() => ({
    compressPdf: compressionRuntime.compressPdf,
    dispose: compressionRuntime.dispose,
  })),
}))

function createHarness() {
  const documentStore = {
    contentPages: [],
    pages: [],
    contentPageCount: 0,
    outlineTree: [],
    sources: new Map(),
    sourceFileList: [],
  } as unknown as DocumentState

  const pdfRepository = {
    getPdfDocument: vi.fn(),
    getPdfBlob: vi.fn(),
  } as unknown as PdfRepository

  return {
    documentStore,
    pdfRepository,
    settings: {
      filenamePattern: { value: '{name}' },
    },
  }
}

describe('document export service cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disposes the compression runtime when the service created it', () => {
    const harness = createHarness()
    const service = createDocumentExportService({
      documentStore: harness.documentStore,
      pdfRepository: harness.pdfRepository,
      settings: harness.settings,
    })

    service.dispose()

    expect(compressionRuntime.dispose).toHaveBeenCalledOnce()
  })

  it('does not dispose an injected compression binding it does not own', () => {
    const harness = createHarness()
    const externalCompression = {
      compressPdf: vi.fn(),
      dispose: vi.fn(),
    }
    const service = createDocumentExportService({
      documentStore: harness.documentStore,
      pdfRepository: harness.pdfRepository,
      settings: harness.settings,
      compression: externalCompression,
    })

    service.dispose()

    expect(externalCompression.dispose).not.toHaveBeenCalled()
    expect(compressionRuntime.dispose).not.toHaveBeenCalled()
  })
})
