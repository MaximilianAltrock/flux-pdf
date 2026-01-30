import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFString, PDFRef, PDFDict, degrees } from 'pdf-lib'
import { EXPORT_PROGRESS, PAGE_NUMBER_BASE, PDF_PAGE_INDEX_BASE } from '@/constants'
import type { PDFPage } from 'pdf-lib'
import type { BookmarkNode, PageEntry, PageReference, DocumentMetadata, RedactionMark } from '@/types'
import type { PDFDocumentProxy } from 'pdfjs-dist'

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
  getPdfDocument?: (sourceFileId: string) => Promise<PDFDocumentProxy>
  burnScale?: number
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
        for (let i = Math.max(PAGE_NUMBER_BASE, start); i <= Math.min(maxPages, end); i++) {
          indices.add(i - PAGE_NUMBER_BASE)
        }
      }
    } else {
      const pageNum = parseInt(part, 10)
      if (!isNaN(pageNum) && pageNum >= PAGE_NUMBER_BASE && pageNum <= maxPages) {
        indices.add(pageNum - PAGE_NUMBER_BASE)
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

function applyTargetDimensions(
  pdfPage: PDFPage,
  target?: { width: number; height: number } | null,
): void {
  if (!target) return
  if (target.width <= 0 || target.height <= 0) return

  const current = pdfPage.getSize()
  if (current.width <= 0 || current.height <= 0) return

  const scale = Math.min(target.width / current.width, target.height / current.height)

  pdfPage.setSize(target.width, target.height)

  if (scale !== 1) {
    pdfPage.scaleContent(scale, scale)
    pdfPage.scaleAnnotations(scale, scale)
  }

  const xOffset = (target.width - current.width * scale) / 2
  const yOffset = (target.height - current.height * scale) / 2

  if (xOffset !== 0 || yOffset !== 0) {
    pdfPage.translateContent(xOffset, yOffset)
  }
}

const DEFAULT_BURN_SCALE = 2

async function rasterizePageWithRedactions(
  pageRef: PageReference,
  redactions: RedactionMark[],
  options: {
    getPdfDocument: (sourceFileId: string) => Promise<PDFDocumentProxy>
    scale: number
  },
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const pdfDoc = await options.getPdfDocument(pageRef.sourceFileId)
  const page = await pdfDoc.getPage(pageRef.sourcePageIndex + PDF_PAGE_INDEX_BASE)
  const rotation = pageRef.rotation ?? 0
  const viewport = page.getViewport({ scale: 1, rotation })
  const scaledViewport = page.getViewport({ scale: options.scale, rotation })
  const scaleX = scaledViewport.width / viewport.width
  const scaleY = scaledViewport.height / viewport.height

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to create canvas context for redaction burn')
  }

  canvas.width = Math.floor(scaledViewport.width)
  canvas.height = Math.floor(scaledViewport.height)

  const renderTask = page.render({
    canvas,
    canvasContext: context,
    viewport: scaledViewport,
  })

  await renderTask.promise

  for (const redaction of redactions) {
    const fill = redaction.color === 'white' ? '#ffffff' : '#000000'
    context.fillStyle = fill
    context.fillRect(
      redaction.x * scaleX,
      redaction.y * scaleY,
      redaction.width * scaleX,
      redaction.height * scaleY,
    )
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create redaction blob'))), 'image/png')
  })

  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { bytes, width: viewport.width, height: viewport.height }
}

function fitContentToPage(
  content: { width: number; height: number },
  target?: { width: number; height: number } | null,
): { pageWidth: number; pageHeight: number; drawWidth: number; drawHeight: number; offsetX: number; offsetY: number } {
  const pageWidth = target?.width ?? content.width
  const pageHeight = target?.height ?? content.height

  if (!target) {
    return {
      pageWidth,
      pageHeight,
      drawWidth: content.width,
      drawHeight: content.height,
      offsetX: 0,
      offsetY: 0,
    }
  }

  const scale = Math.min(pageWidth / content.width, pageHeight / content.height)
  const drawWidth = content.width * scale
  const drawHeight = content.height * scale
  const offsetX = (pageWidth - drawWidth) / 2
  const offsetY = (pageHeight - drawHeight) / 2

  return { pageWidth, pageHeight, drawWidth, drawHeight, offsetX, offsetY }
}

/**
 * Generates a Uint8Array PDF from a list of PageReferences.
 */
export async function generateRawPdf(
  pages: PageReference[],
  options: GenerateRawPdfOptions,
): Promise<Uint8Array> {
  const { metadata, compress, onProgress, getPdfBlob, getPdfDocument, burnScale, bookmarks } = options
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

  let processedPages = 0
  const totalPages = pages.length
  const burnScaleValue = burnScale ?? DEFAULT_BURN_SCALE

  for (const pageRef of pages) {
    const redactions = pageRef.redactions ?? []
    if (redactions.length > 0) {
      if (!getPdfDocument) {
        throw new Error('Redactions require PDF rendering support')
      }

      const raster = await rasterizePageWithRedactions(pageRef, redactions, {
        getPdfDocument,
        scale: burnScaleValue,
      })
      const image = await finalPdf.embedPng(raster.bytes)
      const layout = fitContentToPage(
        { width: raster.width, height: raster.height },
        pageRef.targetDimensions,
      )
      const pdfPage = finalPdf.addPage([layout.pageWidth, layout.pageHeight])
      pdfPage.drawImage(image, {
        x: layout.offsetX,
        y: layout.offsetY,
        width: layout.drawWidth,
        height: layout.drawHeight,
      })
    } else {
      let sourcePdf = loadedPdfs.get(pageRef.sourceFileId)
      if (!sourcePdf) {
        const sourceBuffer = await getPdfBlob(pageRef.sourceFileId)
        if (!sourceBuffer) {
          throw new Error(`Source file not found: ${pageRef.sourceFileId}`)
        }
        sourcePdf = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
        loadedPdfs.set(pageRef.sourceFileId, sourcePdf)
      }

      const copiedPages = await finalPdf.copyPages(sourcePdf, [pageRef.sourcePageIndex])
      const pdfPage = copiedPages[0]
      if (!pdfPage) {
        throw new Error('Failed to copy page')
      }

      if (pageRef.targetDimensions) {
        applyTargetDimensions(pdfPage, pageRef.targetDimensions)
      }

      if (pageRef.rotation !== 0) {
        const currentRotation = pdfPage.getRotation().angle
        pdfPage.setRotation(degrees(currentRotation + pageRef.rotation))
      }

      finalPdf.addPage(pdfPage)
    }

    processedPages++
    if (onProgress) {
      onProgress(Math.round((processedPages / totalPages) * EXPORT_PROGRESS.PAGE_COPY_MAX))
    }

    if (processedPages % 4 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
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
    useObjectStreams: compress ?? false,
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
