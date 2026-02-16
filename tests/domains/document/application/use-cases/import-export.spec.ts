import { describe, expect, it, vi } from 'vitest'
import { importPdf } from '@/domains/document/application/use-cases/import-pdf'
import { exportPdf } from '@/domains/document/application/use-cases/export-pdf'

describe('document use-cases: import/export', () => {
  it('forwards import to document service with files and options', async () => {
    const expected = {
      ok: true as const,
      value: {
        results: [],
        successes: [],
        errors: [],
        totalPages: 0,
      },
    }
    const service = {
      importFiles: vi.fn().mockResolvedValue(expected),
    }
    const files = [new File(['x'], 'sample.pdf', { type: 'application/pdf' })]

    const result = await importPdf(service, files, { addPages: false })

    expect(service.importFiles).toHaveBeenCalledOnce()
    expect(service.importFiles).toHaveBeenCalledWith(files, { addPages: false })
    expect(result).toEqual(expected)
  })

  it('forwards export to document service with export options', async () => {
    const expected = {
      ok: true as const,
      value: {
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3]),
        size: 3,
      },
    }
    const service = {
      exportDocument: vi.fn().mockResolvedValue(expected),
    }
    const options = {
      filename: 'document',
      compress: false,
      metadata: {
        title: 'Doc',
        author: '',
        subject: '',
        keywords: [],
      },
      outline: {
        include: true,
        flatten: false,
        expandAll: false,
      },
    }

    const result = await exportPdf(service, options)

    expect(service.exportDocument).toHaveBeenCalledOnce()
    expect(service.exportDocument).toHaveBeenCalledWith(options)
    expect(result).toEqual(expected)
  })
})
