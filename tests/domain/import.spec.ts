import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/db'

const { mockGetDocument, createMockPdfDoc } = vi.hoisted(() => {
  const mockGetDocument = vi.fn()
  const createMockPdfDoc = () => ({
    numPages: 2,
    getOutline: vi.fn().mockResolvedValue([
      { title: 'Chapter 1', dest: [0], items: [] },
      { title: '', dest: [1], items: [] },
    ]),
    getMetadata: vi.fn().mockResolvedValue({
      info: {
        Title: 'My PDF',
        Author: 'Jane',
        Subject: 'Docs',
        Keywords: 'alpha, beta',
        PDFFormatVersion: '1.7',
      },
    }),
    getDestination: vi.fn().mockResolvedValue([1]),
    getPageIndex: vi.fn().mockResolvedValue(0),
  })
  return { mockGetDocument, createMockPdfDoc }
})

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (args: unknown) => mockGetDocument(args),
}))

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'mock-worker' }))

import {
  clearPdfCache,
  getPdfBlob,
  getPdfDocument,
  loadPdfFile,
  loadPdfFiles,
} from '@/domain/document/import'

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
const PNG_BYTES = new Uint8Array(Buffer.from(PNG_BASE64, 'base64'))

beforeEach(async () => {
  mockGetDocument.mockReset()
  mockGetDocument.mockImplementation(() => ({ promise: Promise.resolve(createMockPdfDoc()) }))
  await db.files.clear()
})

afterEach(async () => {
  clearPdfCache()
  await db.files.clear()
})

describe('loadPdfFile', () => {
  it('loads a PDF, stores metadata, and creates page refs', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'sample.pdf', {
      type: 'application/pdf',
    })

    const result = await loadPdfFile(file, { colorIndex: 0 })

    expect(result.success).toBe(true)
    expect(result.sourceFile?.filename).toBe('sample.pdf')
    expect(result.sourceFile?.pageCount).toBe(2)
    expect(result.pageRefs).toHaveLength(2)
    expect(result.sourceFile?.outline?.[0]?.title).toBe('Chapter 1')
    expect(result.sourceFile?.outline?.[1]?.title).toBe('Untitled')
    expect(result.sourceFile?.metadata?.title).toBe('My PDF')
    expect(result.sourceFile?.metadata?.keywords).toEqual(['alpha', 'beta'])
    expect(result.sourceFile?.metadata?.pdfVersion).toBe('1.7')

    const stored = await db.files.toArray()
    expect(stored).toHaveLength(1)
  })

  it('returns an error when pdfjs fails to load', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetDocument.mockImplementationOnce(() => ({
      promise: Promise.reject(new Error('bad pdf')),
    }))

    const file = new File([new Uint8Array([9, 9, 9])], 'broken.pdf', {
      type: 'application/pdf',
    })

    try {
      const result = await loadPdfFile(file, { colorIndex: 0 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('bad pdf')
      expect(result.errorCode).toBe('IMPORT_PDF_LOAD_FAILED')
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('loadPdfFiles', () => {
  it('loads only supported files', async () => {
    const pdfA = new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' })
    const pdfB = new File([new Uint8Array([2])], 'b.pdf', { type: 'application/pdf' })
    const txt = new File([new Uint8Array([3])], 'c.txt', { type: 'text/plain' })

    const results = await loadPdfFiles([pdfA, pdfB, txt])

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.success)).toBe(true)
  })

  it('converts PNG images into PDFs', async () => {
    const pngFile = new File([PNG_BYTES], 'image.png', { type: 'image/png' })
    const results = await loadPdfFiles([pngFile])

    expect(results).toHaveLength(1)
    expect(results[0]?.success).toBe(true)
    expect(results[0]?.pageRefs?.length).toBe(2)
  })

  it('skips unsupported image formats', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const gifFile = new File([new Uint8Array([1, 2, 3])], 'image.gif', { type: 'image/gif' })
    try {
      const results = await loadPdfFiles([gifFile])
      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(false)
      expect(results[0]?.errorCode).toBe('IMPORT_IMAGE_CONVERSION_FAILED')
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('getPdfDocument', () => {
  it('caches loaded documents', async () => {
    const data = new Uint8Array([1, 2, 3]).buffer
    await db.files.add({
      id: 'source-1',
      data,
      filename: 'test.pdf',
      fileSize: 3,
      pageCount: 1,
      addedAt: Date.now(),
      color: '#000000',
    })

    const docA = await getPdfDocument('source-1')
    const docB = await getPdfDocument('source-1')

    expect(docA).toBe(docB)
    expect(mockGetDocument).toHaveBeenCalledTimes(1)
  })

  it('throws when the source file is missing', async () => {
    await expect(getPdfDocument('missing')).rejects.toThrow('missing from storage')
  })
})

describe('getPdfBlob', () => {
  it('returns the stored array buffer', async () => {
    const data = new Uint8Array([9, 9, 9]).buffer
    await db.files.add({
      id: 'source-blob',
      data,
      filename: 'blob.pdf',
      fileSize: 3,
      pageCount: 1,
      addedAt: Date.now(),
      color: '#123456',
    })

    const blob = await getPdfBlob('source-blob')
    expect(blob).toBeDefined()
    expect(new Uint8Array(blob as ArrayBuffer)).toEqual(new Uint8Array(data))
  })
})
