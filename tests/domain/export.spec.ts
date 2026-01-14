import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import { addBookmarks, generateRawPdf, mapBookmarksToExport } from '@/domain/document/export'
import {
  ROTATION_DEFAULT_DEGREES,
  ROTATION_DELTA_DEGREES,
  type RotationAngle,
} from '@/constants'
import type { BookmarkNode, PageReference } from '@/types'
import { createPdfBytes } from '../helpers/pdf-fixtures'

const makePageRef = (
  id: string,
  sourcePageIndex: number,
  rotation: RotationAngle = ROTATION_DEFAULT_DEGREES,
): PageReference => ({
  id,
  sourceFileId: 'source-1',
  sourcePageIndex,
  rotation,
  groupId: 'group-1',
})

describe('generateRawPdf', () => {
  it('generates a PDF with selected pages and rotation', async () => {
    const sourceBytes = await createPdfBytes(2)
    const sourceBuffer = sourceBytes.buffer.slice(
      sourceBytes.byteOffset,
      sourceBytes.byteOffset + sourceBytes.byteLength,
    )

    const pages = [
      makePageRef('p1', 0, ROTATION_DELTA_DEGREES.RIGHT),
      makePageRef('p2', 1, ROTATION_DEFAULT_DEGREES),
    ]

    const pdfBytes = await generateRawPdf(pages, {
      getPdfBlob: async (sourceId) => (sourceId === 'source-1' ? sourceBuffer : undefined),
    })

    const output = await PDFDocument.load(pdfBytes)
    expect(output.getPageCount()).toBe(2)
    expect(output.getPage(0).getRotation().angle).toBe(ROTATION_DELTA_DEGREES.RIGHT)
  })

  it('applies metadata to the exported PDF', async () => {
    const sourceBytes = await createPdfBytes(1)
    const sourceBuffer = sourceBytes.buffer.slice(
      sourceBytes.byteOffset,
      sourceBytes.byteOffset + sourceBytes.byteLength,
    )

    const pages = [makePageRef('p1', 0, ROTATION_DEFAULT_DEGREES)]

    const pdfBytes = await generateRawPdf(pages, {
      metadata: {
        title: 'Flux Report',
        author: 'Jane Doe',
        subject: 'Exports',
        keywords: ['alpha', 'beta'],
      },
      getPdfBlob: async (sourceId) => (sourceId === 'source-1' ? sourceBuffer : undefined),
    })

    const output = await PDFDocument.load(pdfBytes)
    expect(output.getTitle()).toBe('Flux Report')
    expect(output.getAuthor()).toBe('Jane Doe')
    expect(output.getSubject()).toBe('Exports')
    expect(output.getKeywords()).toContain('alpha')
  })

  it('throws when a source file is missing', async () => {
    const pages = [makePageRef('p1', 0, ROTATION_DEFAULT_DEGREES)]
    await expect(
      generateRawPdf(pages, { getPdfBlob: async () => undefined }),
    ).rejects.toThrow('Source file not found')
  })
})

describe('mapBookmarksToExport', () => {
  it('filters bookmarks without valid pages', () => {
    const nodes: BookmarkNode[] = [
      {
        id: 'b1',
        title: 'Chapter 1',
        pageId: 'p1',
        expanded: true,
        children: [
          {
            id: 'b2',
            title: 'Missing',
            pageId: 'missing',
            expanded: true,
            children: [],
          },
        ],
      },
      {
        id: 'b3',
        title: 'Missing Root',
        pageId: 'missing-root',
        expanded: false,
        children: [],
      },
    ]

    const pageIdToIndex = new Map<string, number>([['p1', 0]])
    const mapped = mapBookmarksToExport(nodes, pageIdToIndex)

    expect(mapped).toEqual([
      {
        title: 'Chapter 1',
        pageIndex: 0,
        expanded: true,
      },
    ])
  })
})

describe('addBookmarks', () => {
  it('adds outlines to the PDF catalog', async () => {
    const pdfDoc = await PDFDocument.create()
    pdfDoc.addPage()

    await addBookmarks(pdfDoc, [{ title: 'Chapter', pageIndex: 0 }])

    const catalog = (pdfDoc as unknown as { catalog: { get: (name: PDFName) => unknown } })
      .catalog
    const outlines = catalog.get(PDFName.of('Outlines'))
    const pageMode = catalog.get(PDFName.of('PageMode'))

    expect(outlines).toBeTruthy()
    expect(pageMode).toBeTruthy()
  })
})
