import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFRef, PDFDict, degrees } from 'pdf-lib'
import type { PDFPage } from 'pdf-lib'
import type { BookmarkNode, PageEntry, PageReference, DocumentMetadata } from '@/types'

/**
 * Export metadata options (based on DocumentMetadata)
 */
export type ExportMetadata = DocumentMetadata & {
  creator?: string
  producer?: string
}

export interface ExportResult {
  filename: string
  mimeType: string
  bytes: Uint8Array
  size: number
  originalSize?: number
  compressionRatio?: number
}

/**
 * Export options
 */
export interface ExportOptions {
  filename: string
  pageRange?: string
  metadata?: ExportMetadata
  compress?: boolean
  compressionQuality?: import('@/composables/usePdfCompression').CompressionQuality | 'none'
}

/**
 * Options for the raw generator
 */
export interface GeneratorOptions {
  metadata?: ExportMetadata
  compress?: boolean
  onProgress?: (percent: number) => void
}

export interface GenerateRawPdfOptions extends GeneratorOptions {
  getPdfBlob: (sourceFileId: string) => Promise<ArrayBuffer | undefined>
  bookmarks?: BookmarkNode[]
}

export interface ResolveExportPagesOptions {
  pages: PageEntry[]
  contentPages: PageReference[]
  contentPageCount: number
  pageRange?: string
}

function normalizeExportMetadata(metadata?: ExportMetadata): ExportMetadata | null {
  if (!metadata) return null

  const title = typeof metadata.title === 'string' ? metadata.title.trim() : ''
  const author = typeof metadata.author === 'string' ? metadata.author.trim() : ''
  const subject = typeof metadata.subject === 'string' ? metadata.subject.trim() : ''
  const keywords = Array.isArray(metadata.keywords)
    ? metadata.keywords.map((k) => k.trim()).filter(Boolean)
    : []
  const creator = metadata.creator?.trim()
  const producer = metadata.producer?.trim()

  if (!title && !author && !subject && keywords.length === 0 && !creator && !producer) {
    return null
  }

  return {
    ...metadata,
    title,
    author,
    subject,
    keywords,
    ...(creator ? { creator } : {}),
    ...(producer ? { producer } : {}),
  }
}

export function parsePageRange(rangeStr: string, maxPages: number): number[] {
  const indices: Set<number> = new Set()

  const parts = rangeStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim())
      if (!startStr || !endStr) continue
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
          indices.add(i - 1)
        }
      }
    } else {
      const pageNum = parseInt(part, 10)
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
        indices.add(pageNum - 1)
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

export function validatePageRange(
  rangeStr: string,
  maxPages: number,
): { valid: boolean; error?: string } {
  if (!rangeStr.trim()) {
    return { valid: false, error: 'Page range is required' }
  }

  const indices = parsePageRange(rangeStr, maxPages)

  if (indices.length === 0) {
    return { valid: false, error: 'No valid pages in range' }
  }

  return { valid: true }
}

export function resolvePagesToExport(options: ResolveExportPagesOptions): PageEntry[] {
  const { pageRange, contentPageCount, contentPages, pages } = options
  if (!pageRange) return pages

  const indices = parsePageRange(pageRange, contentPageCount)
  return indices.map((i) => contentPages[i]).filter((p): p is PageReference => !!p)
}

export function splitPagesIntoSegments(pages: PageEntry[]): PageReference[][] {
  const segments: PageReference[][] = []
  let currentSegment: PageReference[] = []

  for (const page of pages) {
    if (page.isDivider) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment)
        currentSegment = []
      }
    } else {
      currentSegment.push(page)
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment)
  }

  return segments
}

/**
 * Generates a Uint8Array PDF from a list of PageReferences.
 */
export async function generateRawPdf(
  pages: PageReference[],
  options: GenerateRawPdfOptions,
): Promise<Uint8Array> {
  const { metadata, compress, onProgress, getPdfBlob, bookmarks } = options
  const exportMetadata = normalizeExportMetadata(metadata)

  const finalPdf = await PDFDocument.create()

  if (exportMetadata) {
    if (exportMetadata.title) finalPdf.setTitle(exportMetadata.title)
    if (exportMetadata.author) finalPdf.setAuthor(exportMetadata.author)
    if (exportMetadata.subject) finalPdf.setSubject(exportMetadata.subject)
    if (exportMetadata.keywords.length) finalPdf.setKeywords(exportMetadata.keywords)
    if (exportMetadata.creator) finalPdf.setCreator(exportMetadata.creator)
    finalPdf.setProducer(exportMetadata.producer ?? 'FluxPDF')
    finalPdf.setCreationDate(new Date())
    finalPdf.setModificationDate(new Date())
  } else {
    finalPdf.setProducer('FluxPDF')
    finalPdf.setCreationDate(new Date())
  }

  const loadedPdfs = new Map<string, PDFDocument>()
  const pagesBySource = new Map<string, { pageRef: PageReference; finalIndex: number }[]>()

  pages.forEach((page, index) => {
    if (!pagesBySource.has(page.sourceFileId)) {
      pagesBySource.set(page.sourceFileId, [])
    }
    pagesBySource.get(page.sourceFileId)!.push({ pageRef: page, finalIndex: index })
  })

  const importedPages: Array<PDFPage | undefined> = Array.from({ length: pages.length })

  let processedPages = 0
  const totalPages = pages.length

  for (const [sourceId, items] of pagesBySource) {
    let sourcePdf = loadedPdfs.get(sourceId)

    if (!sourcePdf) {
      const sourceBuffer = await getPdfBlob(sourceId)
      if (!sourceBuffer) {
        throw new Error(`Source file not found: ${sourceId}`)
      }
      sourcePdf = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
      loadedPdfs.set(sourceId, sourcePdf)
    }

    const sourceIndices = items.map((item) => item.pageRef.sourcePageIndex)
    const copiedPages = await finalPdf.copyPages(sourcePdf, sourceIndices)

    if (copiedPages.length !== items.length) {
      throw new Error('Failed to copy some pages')
    }

    for (let i = 0; i < copiedPages.length; i++) {
      const pdfPage = copiedPages[i]
      const item = items[i]

      if (!item || !pdfPage) continue

      const { pageRef, finalIndex } = item

      if (pageRef.rotation !== 0) {
        const currentRotation = pdfPage.getRotation().angle
        pdfPage.setRotation(degrees(currentRotation + pageRef.rotation))
      }

      importedPages[finalIndex] = pdfPage
      processedPages++

      if (onProgress) {
        onProgress(Math.round((processedPages / totalPages) * 90))
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  for (const page of importedPages) {
    if (page) {
      finalPdf.addPage(page)
    }
  }

  const pageIdToIndex = new Map<string, number>()
  let idx = 0
  for (const p of pages) {
    if (p.isDivider) continue
    pageIdToIndex.set(p.id, idx++)
  }

  const exportBookmarks = mapBookmarksToExport(bookmarks ?? [], pageIdToIndex)
  await addBookmarks(finalPdf, exportBookmarks)

  return await finalPdf.save({
    useObjectStreams: compress ?? true,
    addDefaultPage: false,
  })
}

export interface ExportBookmarkNode {
  title: string
  pageIndex: number
  children?: ExportBookmarkNode[]
  expanded?: boolean
}

export function mapBookmarksToExport(
  uiNodes: BookmarkNode[],
  pageIdToIndex: Map<string, number>,
): ExportBookmarkNode[] {
  const mapNode = (n: BookmarkNode): ExportBookmarkNode | null => {
    const pageIndex = pageIdToIndex.get(n.pageId)
    if (pageIndex == null) return null

    const children = (n.children ?? [])
      .map(mapNode)
      .filter((x): x is ExportBookmarkNode => x !== null)

    return {
      title: n.title,
      pageIndex,
      expanded: n.expanded,
      children: children.length ? children : undefined,
    }
  }

  return (uiNodes ?? []).map(mapNode).filter((x): x is ExportBookmarkNode => x !== null)
}

export async function addBookmarks(pdfDoc: PDFDocument, bookmarks: ExportBookmarkNode[]) {
  if (!bookmarks?.length) return

  const ctx = pdfDoc.context
  const outlineRef = ctx.nextRef()

  const outlineDict = ctx.obj({
    Type: PDFName.of('Outlines'),
    Count: PDFNumber.of(countVisible(bookmarks)),
  }) as PDFDict

  const { firstRef, lastRef } = await createOutlineItems(pdfDoc, bookmarks, outlineRef)

  outlineDict.set(PDFName.of('First'), firstRef)
  outlineDict.set(PDFName.of('Last'), lastRef)

  ctx.assign(outlineRef, outlineDict)

  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef)
  pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

async function createOutlineItems(
  pdfDoc: PDFDocument,
  nodes: ExportBookmarkNode[],
  parentRef: PDFRef,
): Promise<{ firstRef: PDFRef; lastRef: PDFRef }> {
  const ctx = pdfDoc.context
  const refs: PDFRef[] = nodes.map(() => ctx.nextRef())

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    const ref = refs[i]!
    const prev = i > 0 ? refs[i - 1] : undefined
    const next = i < nodes.length - 1 ? refs[i + 1] : undefined

    const page = pdfDoc.getPage(node.pageIndex)

    const dest = PDFArray.withContext(ctx)
    dest.push(page.ref)
    dest.push(PDFName.of('FitH'))
    dest.push(PDFNumber.of(page.getHeight()))

    const itemDict = ctx.obj({
      Title: PDFString.of(node.title),
      Parent: parentRef,
      Dest: dest,
      ...(prev ? { Prev: prev } : {}),
      ...(next ? { Next: next } : {}),
    }) as PDFDict

    if (node.children?.length) {
      const { firstRef, lastRef } = await createOutlineItems(pdfDoc, node.children, ref)

      itemDict.set(PDFName.of('First'), firstRef)
      itemDict.set(PDFName.of('Last'), lastRef)

      const descendants = countDescendants(node.children)
      const isOpen = node.expanded !== false
      itemDict.set(PDFName.of('Count'), PDFNumber.of(isOpen ? descendants : -descendants))
    }

    ctx.assign(ref, itemDict)
  }

  return { firstRef: refs[0]!, lastRef: refs[refs.length - 1]! }
}

function countDescendants(nodes: ExportBookmarkNode[]): number {
  let count = 0
  for (const n of nodes) {
    count += 1
    if (n.children?.length) count += countDescendants(n.children)
  }
  return count
}

function countVisible(nodes: ExportBookmarkNode[]): number {
  let count = 0
  for (const n of nodes) {
    count += 1
    const isOpen = n.expanded !== false
    if (isOpen && n.children?.length) count += countVisible(n.children)
  }
  return count
}
