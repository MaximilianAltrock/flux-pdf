import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { useDocumentStore } from '@/stores/document'
import { useCommandManager } from '@/composables/useCommandManager'
import { db } from '@/db/db'
import type { FileUploadResult, PageEntry, PageReference, SourceFile } from '@/types'
import { createPdfBytes } from '../helpers/pdf-fixtures'
import type { DocumentAdaptersOverrides } from '@/domain/document/ports'
import { useDocumentService } from '@/composables/useDocumentService'

const mockLoadPdfFiles = vi.fn()
const mockClearPdfCache = vi.fn()
const mockLoadSession = vi.fn()
const mockPersistSession = vi.fn()
const mockGetPdfBlob = vi.fn()
const mockCompressPdf = vi.fn()

function createAdapters(): DocumentAdaptersOverrides {
  return {
    import: {
      loadPdfFiles: mockLoadPdfFiles,
      getPdfDocument: vi.fn(),
      getPdfBlob: mockGetPdfBlob,
      clearPdfCache: mockClearPdfCache,
    },
    session: {
      persistSession: mockPersistSession,
      loadSession: mockLoadSession,
    },
    compression: {
      compressPdf: mockCompressPdf,
    },
  }
}

const makeSource = (
  id: string,
  filename: string,
  pageCount: number,
  fileSize: number,
): SourceFile => ({
  id,
  filename,
  pageCount,
  fileSize,
  addedAt: Date.now(),
  color: '#111111',
})

const makePages = (sourceId: string, count: number): PageReference[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${sourceId}-p${i}`,
    sourceFileId: sourceId,
    sourcePageIndex: i,
    rotation: 0,
    groupId: sourceId,
  }))

beforeEach(async () => {
  setActivePinia(createPinia())
  useCommandManager().clearHistory()
  mockLoadPdfFiles.mockReset()
  mockLoadSession.mockReset()
  mockPersistSession.mockReset()
  mockClearPdfCache.mockReset()
  mockGetPdfBlob.mockReset()
  mockCompressPdf.mockReset()
  mockLoadSession.mockResolvedValue(undefined)
  await db.files.clear()
  await db.session.clear()
})

describe('importFiles', () => {
  it('imports files and updates the store', async () => {
    const sourceA = makeSource('s1', 'one.pdf', 2, 1200)
    const sourceB = makeSource('s2', 'two.pdf', 1, 600)
    const pagesA = makePages('s1', 2)
    const pagesB = makePages('s2', 1)

    const results: FileUploadResult[] = [
      { success: true, sourceFile: sourceA, pageRefs: pagesA },
      { success: true, sourceFile: sourceB, pageRefs: pagesB },
    ]

    mockLoadPdfFiles.mockResolvedValue(results)

    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    const files = [
      new File([new Uint8Array([1])], 'one.pdf', { type: 'application/pdf' }),
      new File([new Uint8Array([2])], 'two.pdf', { type: 'application/pdf' }),
    ]

    const result = await service.importFiles(files)

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.totalPages).toBe(3)
    expect(store.sources.size).toBe(2)
    expect(store.pages).toHaveLength(3)
    expect(mockLoadPdfFiles).toHaveBeenCalledTimes(1)
  })
})

describe('getSuggestedFilename', () => {
  it('builds a name from the current sources', () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    expect(service.getSuggestedFilename()).toBe('document')

    store.addSourceFile(makeSource('s1', 'alpha.pdf', 1, 100))
    expect(service.getSuggestedFilename()).toBe('alpha-edited')

    store.addSourceFile(makeSource('s2', 'beta.pdf', 1, 200))
    expect(service.getSuggestedFilename()).toBe('merged-document')
  })
})

describe('getEstimatedSize', () => {
  it('estimates size based on page counts', () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    store.addSourceFile(makeSource('s1', 'one.pdf', 4, 4000))
    store.addSourceFile(makeSource('s2', 'two.pdf', 2, 2000))

    const pages: PageReference[] = [
      { id: 'p1', sourceFileId: 's1', sourcePageIndex: 0, rotation: 0, groupId: 'g1' },
      { id: 'p2', sourceFileId: 's1', sourcePageIndex: 1, rotation: 0, groupId: 'g1' },
      { id: 'p3', sourceFileId: 's2', sourcePageIndex: 0, rotation: 0, groupId: 'g2' },
    ]

    expect(service.getEstimatedSize(pages)).toBe(3000)
  })
})

describe('clearWorkspace', () => {
  it('clears IndexedDB and resets the store', async () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    await db.files.add({
      id: 's1',
      data: new Uint8Array([1]).buffer,
      filename: 'one.pdf',
      fileSize: 1,
      pageCount: 1,
      addedAt: Date.now(),
      color: '#111111',
    })

    await db.session.put({
      id: 'current-session',
      schemaVersion: 1,
      projectTitle: 'Test',
      activeSourceIds: ['s1'],
      pageMap: [],
      history: [],
      historyPointer: -1,
      zoom: 200,
      updatedAt: Date.now(),
    })

    store.addSourceFile(makeSource('s1', 'one.pdf', 1, 1))
    store.addPages(makePages('s1', 1))

    const result = await service.clearWorkspace()

    expect(result.ok).toBe(true)
    expect(store.sources.size).toBe(0)
    expect(store.pages).toHaveLength(0)
    expect(await db.files.count()).toBe(0)
    expect(await db.session.count()).toBe(0)
    expect(mockClearPdfCache).toHaveBeenCalledTimes(1)
  })
})

describe('exportDocument', () => {
  it('returns bytes and metadata without downloading', async () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    const pdfBytes = await createPdfBytes(1)
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    )

    await db.files.add({
      id: 's-export',
      data: buffer,
      filename: 'source.pdf',
      fileSize: pdfBytes.byteLength,
      pageCount: 1,
      addedAt: Date.now(),
      color: '#222222',
    })

    store.addSourceFile(makeSource('s-export', 'source.pdf', 1, pdfBytes.byteLength))
    store.addPages(makePages('s-export', 1))

    mockGetPdfBlob.mockImplementation(async (sourceId: string) => {
      const record = await db.files.get(sourceId)
      return record?.data
    })

    const result = await service.exportDocument({
      filename: 'exported',
      compressionQuality: 'none',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.filename).toBe('exported.pdf')
    expect(result.value.mimeType).toBe('application/pdf')
    expect(result.value.bytes).toBeInstanceOf(Uint8Array)
    expect(result.value.size).toBe(result.value.bytes.byteLength)
  })

  it('returns an error when there are no pages to export', async () => {
    const service = useDocumentService(createAdapters())

    const result = await service.exportDocument({ filename: 'empty' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toBe('No pages to export')
    expect(result.error.code).toBe('EXPORT_NO_PAGES')
  })

  it('exports a custom page range', async () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    const pdfBytes = await createPdfBytes(2)
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    )

    await db.files.add({
      id: 's-range',
      data: buffer,
      filename: 'range.pdf',
      fileSize: pdfBytes.byteLength,
      pageCount: 2,
      addedAt: Date.now(),
      color: '#333333',
    })

    store.addSourceFile(makeSource('s-range', 'range.pdf', 2, pdfBytes.byteLength))
    store.addPages(makePages('s-range', 2))

    mockGetPdfBlob.mockImplementation(async (sourceId: string) => {
      const record = await db.files.get(sourceId)
      return record?.data
    })

    const result = await service.exportDocument({
      filename: 'range-export',
      pageRange: '2',
      compressionQuality: 'none',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const output = await PDFDocument.load(result.value.bytes)
    expect(output.getPageCount()).toBe(1)
  })

  it('returns a zip when dividers split export segments', async () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    const pdfBytesA = await createPdfBytes(1)
    const pdfBytesB = await createPdfBytes(1)
    const bufferA = pdfBytesA.buffer.slice(
      pdfBytesA.byteOffset,
      pdfBytesA.byteOffset + pdfBytesA.byteLength,
    )
    const bufferB = pdfBytesB.buffer.slice(
      pdfBytesB.byteOffset,
      pdfBytesB.byteOffset + pdfBytesB.byteLength,
    )

    await db.files.bulkAdd([
      {
        id: 's-a',
        data: bufferA,
        filename: 'a.pdf',
        fileSize: pdfBytesA.byteLength,
        pageCount: 1,
        addedAt: Date.now(),
        color: '#444444',
      },
      {
        id: 's-b',
        data: bufferB,
        filename: 'b.pdf',
        fileSize: pdfBytesB.byteLength,
        pageCount: 1,
        addedAt: Date.now(),
        color: '#555555',
      },
    ])

    store.addSourceFile(makeSource('s-a', 'a.pdf', 1, pdfBytesA.byteLength))
    store.addSourceFile(makeSource('s-b', 'b.pdf', 1, pdfBytesB.byteLength))

    const divider: PageEntry = { id: 'divider-1', isDivider: true }
    store.setPages([makePages('s-a', 1)[0]!, divider, makePages('s-b', 1)[0]!])

    mockGetPdfBlob.mockImplementation(async (sourceId: string) => {
      const record = await db.files.get(sourceId)
      return record?.data
    })

    const result = await service.exportDocument({
      filename: 'bundle',
      compressionQuality: 'none',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.filename).toBe('bundle.zip')
    expect(result.value.mimeType).toBe('application/zip')

    const zip = await JSZip.loadAsync(result.value.bytes)
    const names = Object.keys(zip.files).sort()
    expect(names).toEqual(['bundle-part1.pdf', 'bundle-part2.pdf'])
  })

  it('applies metadata to exported PDFs', async () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    const pdfBytes = await createPdfBytes(1)
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    )

    await db.files.add({
      id: 's-meta',
      data: buffer,
      filename: 'meta.pdf',
      fileSize: pdfBytes.byteLength,
      pageCount: 1,
      addedAt: Date.now(),
      color: '#666666',
    })

    store.addSourceFile(makeSource('s-meta', 'meta.pdf', 1, pdfBytes.byteLength))
    store.addPages(makePages('s-meta', 1))

    mockGetPdfBlob.mockImplementation(async (sourceId: string) => {
      const record = await db.files.get(sourceId)
      return record?.data
    })

    const result = await service.exportDocument({
      filename: 'meta-export',
      compressionQuality: 'none',
      metadata: {
        title: 'Pipeline Report',
        author: 'Flux',
        subject: 'QA',
        keywords: ['pipeline', 'export'],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const output = await PDFDocument.load(result.value.bytes)
    expect(output.getTitle()).toBe('Pipeline Report')
    expect(output.getAuthor()).toBe('Flux')
    expect(output.getSubject()).toBe('QA')
    expect(output.getKeywords()).toContain('pipeline')
  })

  it('reports compression ratio when compression is applied', async () => {
    const service = useDocumentService(createAdapters())
    const store = useDocumentStore()

    const pdfBytes = await createPdfBytes(1)
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    )

    await db.files.add({
      id: 's-compress',
      data: buffer,
      filename: 'compress.pdf',
      fileSize: pdfBytes.byteLength,
      pageCount: 2,
      addedAt: Date.now(),
      color: '#777777',
    })

    store.addSourceFile(makeSource('s-compress', 'compress.pdf', 2, pdfBytes.byteLength))
    store.addPages(makePages('s-compress', 1))

    mockGetPdfBlob.mockImplementation(async (sourceId: string) => {
      const record = await db.files.get(sourceId)
      return record?.data
    })

    mockCompressPdf.mockResolvedValue({
      data: new Uint8Array([1, 2, 3, 4]),
      originalSize: 100,
      compressedSize: 4,
      compressionRatio: 0.96,
    })

    const result = await service.exportDocument({
      filename: 'compressed',
      compressionQuality: 'ebook',
    })

    expect(mockCompressPdf).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.compressionRatio).toBeCloseTo(0.96, 2)
  })
})
