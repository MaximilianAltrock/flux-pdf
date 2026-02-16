import * as pdfjs from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { TextContent } from 'pdfjs-dist/types/src/display/api'
import { PDFDocument } from 'pdf-lib'
import { ROTATION_DEFAULT_DEGREES } from '@/shared/constants'
import { db } from '@/shared/infrastructure/db'
import type {
  DocumentMetadata,
  FileUploadResult,
  PageMetrics,
  PageReference,
  PdfOutlineNode,
  SourceFile,
} from '@/shared/types'
import type { ImportErrorCode } from '@/shared/types/errors'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * PDF cache: Parsed docs in RAM, raw buffers in IndexedDB.
 */
const pdfDocCache = new Map<string, PDFDocumentProxy>()

const PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#06b6d4']
const POINTS_PER_INCH = 72

function getNextColor(index: number): string {
  return PALETTE[index % PALETTE.length] ?? '#3b82f6'
}

function normalizeMetadataValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''
  return String(value).trim()
}

function parseKeywords(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMetadataValue(item)).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const normalized = normalizeMetadataValue(value)
  return normalized ? [normalized] : []
}

function normalizePdfVersion(value: unknown): DocumentMetadata['pdfVersion'] | undefined {
  const normalized = normalizeMetadataValue(value)
  if (normalized === '1.4' || normalized === '1.7' || normalized === '2.0') return normalized
  if (normalized.toUpperCase() === 'PDF/A') return 'PDF/A'
  return undefined
}

function buildDocumentMetadata(info: Record<string, unknown>): DocumentMetadata | null {
  const title = normalizeMetadataValue(info.Title ?? info.title)
  const author = normalizeMetadataValue(info.Author ?? info.author)
  const subject = normalizeMetadataValue(info.Subject ?? info.subject)
  const keywords = parseKeywords(info.Keywords ?? info.keywords)
  const pdfVersion = normalizePdfVersion(info.PDFFormatVersion ?? info.PDFVersion)

  if (!title && !author && !subject && keywords.length === 0) {
    return null
  }

  return {
    title,
    author,
    subject,
    keywords,
    ...(pdfVersion ? { pdfVersion } : {}),
  }
}

function countTextChars(textContent: TextContent | null): number {
  if (!textContent) return 0
  let count = 0
  for (const item of textContent.items) {
    if (typeof (item as { str?: string }).str !== 'string') continue
    count += (item as { str: string }).str.replace(/\s+/g, '').length
  }
  return count
}

function getImageDimensions(value: unknown): { width: number; height: number } | null {
  if (!value || typeof value !== 'object') return null
  const width = (value as { width?: unknown }).width
  const height = (value as { height?: unknown }).height
  if (typeof width !== 'number' || typeof height !== 'number') return null
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

async function analyzePageScanMetrics(
  page: PDFPageProxy,
  pageWidth: number,
  pageHeight: number,
): Promise<Pick<PageMetrics, 'textChars' | 'dominantImageCoverage' | 'dominantImageDpi'>> {
  const [textContent, operatorList] = await Promise.all([
    page.getTextContent().catch(() => null),
    page.getOperatorList().catch(() => null),
  ])

  const textChars = countTextChars(textContent)
  if (!operatorList || pageWidth <= 0 || pageHeight <= 0) {
    return { textChars }
  }

  const pageArea = pageWidth * pageHeight
  let maxCoverage = 0
  let maxDpi = 0
  let ctm: number[] = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = []
  const pendingImages = new Map<string, number[][]>()

  const recordImage = (image: { width: number; height: number }, transform: number[]) => {
    const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
    pdfjs.Util.axialAlignedBoundingBox([0, 0, 1, 1], transform, bounds)
    const drawnWidth = Math.abs(bounds[2] - bounds[0])
    const drawnHeight = Math.abs(bounds[3] - bounds[1])
    if (!Number.isFinite(drawnWidth) || !Number.isFinite(drawnHeight)) return
    if (drawnWidth <= 0 || drawnHeight <= 0) return
    const coverage = Math.min(1, (drawnWidth * drawnHeight) / pageArea)
    const dpiX = image.width / (drawnWidth / POINTS_PER_INCH)
    const dpiY = image.height / (drawnHeight / POINTS_PER_INCH)
    const dpi = Math.min(dpiX, dpiY)
    if (!Number.isFinite(dpi) || dpi <= 0) return
    if (coverage > maxCoverage) {
      maxCoverage = coverage
      maxDpi = dpi
    }
  }

  const queueImage = (objId: string, transform: number[]) => {
    const existing = pendingImages.get(objId)
    if (existing) {
      existing.push(transform)
    } else {
      pendingImages.set(objId, [transform])
    }
  }

  const resolveImageData = (objId: string) =>
    new Promise<{ width: number; height: number } | null>((resolve) => {
      const objs = objId.startsWith('g_') ? page.commonObjs : page.objs
      let settled = false
      const finish = (data: unknown) => {
        if (settled) return
        settled = true
        resolve(getImageDimensions(data))
      }
      try {
        const data = objs.get(objId, finish)
        if (data) finish(data)
      } catch {
        resolve(null)
      }
    })

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i]
    const args = operatorList.argsArray[i]

    switch (fn) {
      case pdfjs.OPS.save:
        stack.push(ctm.slice())
        break
      case pdfjs.OPS.restore:
        ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]
        break
      case pdfjs.OPS.transform: {
        if (Array.isArray(args) && args.length >= 6) {
          const [a, b, c, d, e, f] = args
          if ([a, b, c, d, e, f].every((value) => typeof value === 'number')) {
            ctm = pdfjs.Util.transform(ctm, [a, b, c, d, e, f])
          }
        }
        break
      }
      case pdfjs.OPS.paintInlineImageXObject: {
        const image = getImageDimensions(Array.isArray(args) ? args[0] : undefined)
        if (image) recordImage(image, ctm)
        break
      }
      case pdfjs.OPS.paintInlineImageXObjectGroup: {
        const [imgData, map] = Array.isArray(args) ? args : []
        const image = getImageDimensions(imgData)
        if (image && Array.isArray(map)) {
          for (const entry of map) {
            const transform = entry?.transform
            if (Array.isArray(transform) && transform.length >= 6) {
              const [a, b, c, d, e, f] = transform
              if ([a, b, c, d, e, f].every((value) => typeof value === 'number')) {
                recordImage(image, pdfjs.Util.transform(ctm, [a, b, c, d, e, f]))
              }
            }
          }
        }
        break
      }
      case pdfjs.OPS.paintImageXObject: {
        const objId = Array.isArray(args) ? args[0] : undefined
        if (typeof objId === 'string') {
          queueImage(objId, ctm.slice())
        }
        break
      }
      case pdfjs.OPS.paintImageXObjectRepeat: {
        const [objId, scaleX, scaleY, positions] = Array.isArray(args) ? args : []
        if (
          typeof objId === 'string' &&
          typeof scaleX === 'number' &&
          typeof scaleY === 'number' &&
          Array.isArray(positions)
        ) {
          for (let j = 0; j < positions.length; j += 2) {
            const x = positions[j]
            const y = positions[j + 1]
            if (typeof x !== 'number' || typeof y !== 'number') continue
            const repeatTransform: number[] = [scaleX, 0, 0, scaleY, x, y]
            queueImage(objId, pdfjs.Util.transform(ctm, repeatTransform))
          }
        }
        break
      }
      default:
        break
    }
  }

  for (const [objId, transforms] of pendingImages) {
    const image = await resolveImageData(objId)
    if (!image) continue
    for (const transform of transforms) {
      recordImage(image, transform)
    }
  }

  const result: Pick<PageMetrics, 'textChars' | 'dominantImageCoverage' | 'dominantImageDpi'> = {
    textChars,
  }
  if (maxCoverage > 0) result.dominantImageCoverage = maxCoverage
  if (maxDpi > 0) result.dominantImageDpi = Math.round(maxDpi)
  return result
}

export interface LoadPdfFileOptions {
  colorIndex: number
  isImageSource?: boolean
}

export interface LoadPdfFilesOptions {
  initialColorIndex?: number
}

export async function loadPdfFile(
  file: File,
  options: LoadPdfFileOptions,
): Promise<FileUploadResult> {
  try {
    const arrayBuffer = await file.arrayBuffer()

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) })
    const pdfDoc = await loadingTask.promise
    const outline = await extractPdfOutline(pdfDoc)
    let extractedMetadata: DocumentMetadata | null = null
    try {
      const meta = await pdfDoc.getMetadata()
      extractedMetadata = buildDocumentMetadata((meta?.info ?? {}) as Record<string, unknown>)
    } catch {
      extractedMetadata = null
    }

    const sourceFileId = crypto.randomUUID()
    const color = getNextColor(options.colorIndex)
    const addedAt = Date.now()

    const groupId = crypto.randomUUID()
    const pageMetaData: PageMetrics[] = []
    const pageRefs: PageReference[] = []

    for (let i = 0; i < pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i + 1)
      const viewport = page.getViewport({ scale: 1 })
      const pageRotation = (page as { rotate?: number }).rotate
      const rotation =
        typeof pageRotation === 'number'
          ? pageRotation
          : typeof viewport.rotation === 'number'
            ? viewport.rotation
            : 0
      const metrics: PageMetrics = {
        width: viewport.width,
        height: viewport.height,
        rotation,
      }
      Object.assign(metrics, await analyzePageScanMetrics(page, metrics.width, metrics.height))
      pageMetaData.push(metrics)
      pageRefs.push({
        id: crypto.randomUUID(),
        sourceFileId,
        sourcePageIndex: i,
        rotation: ROTATION_DEFAULT_DEGREES,
        width: metrics.width,
        height: metrics.height,
        groupId,
      })
    }

    await db.files.add({
      id: sourceFileId,
      data: arrayBuffer,
      filename: file.name,
      fileSize: file.size,
      pageCount: pdfDoc.numPages,
      addedAt,
      color,
      pageMetaData,
      isImageSource: options.isImageSource ?? false,
      outline: outline.length ? outline : undefined,
      metadata: extractedMetadata ?? undefined,
    })

    const sourceFile: SourceFile = {
      id: sourceFileId,
      filename: file.name,
      pageCount: pdfDoc.numPages,
      fileSize: file.size,
      addedAt,
      color,
      pageMetaData,
      isImageSource: options.isImageSource ?? false,
      outline: outline.length ? outline : undefined,
      metadata: extractedMetadata ?? undefined,
    }

    pdfDocCache.set(sourceFileId, pdfDoc)

    return { success: true, sourceFile, pageRefs }
  } catch (error) {
    console.error('Failed to load PDF file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'IMPORT_PDF_LOAD_FAILED',
    }
  }
}

export async function loadPdfFiles(
  files: FileList | File[],
  options: LoadPdfFilesOptions = {},
): Promise<FileUploadResult[]> {
  const results: FileUploadResult[] = []
  let colorIndex = options.initialColorIndex ?? 0

  for (const file of Array.from(files)) {
    if (file.type === 'application/pdf') {
      results.push(await loadPdfFile(file, { colorIndex, isImageSource: false }))
      colorIndex++
    } else if (file.type.startsWith('image/')) {
      const conversion = await convertImageToPdf(file)
      if (conversion.success && conversion.file) {
        results.push(await loadPdfFile(conversion.file, { colorIndex, isImageSource: true }))
        colorIndex++
      } else {
        results.push({
          success: false,
          error: conversion.error ?? 'Image conversion failed',
          errorCode: conversion.errorCode ?? 'IMPORT_IMAGE_CONVERSION_FAILED',
        })
      }
    }
  }

  return results
}

export async function getPdfDocument(sourceFileId: string): Promise<PDFDocumentProxy> {
  if (pdfDocCache.has(sourceFileId)) return pdfDocCache.get(sourceFileId)!

  const record = await db.files.get(sourceFileId)
  if (!record) throw new Error(`Source file ${sourceFileId} missing from storage`)

  const loadingTask = pdfjs.getDocument({ data: record.data.slice(0) })
  const pdfDoc = await loadingTask.promise

  pdfDocCache.set(sourceFileId, pdfDoc)
  return pdfDoc
}

export async function getPdfBlob(sourceFileId: string): Promise<ArrayBuffer | undefined> {
  const record = await db.files.get(sourceFileId)
  return record?.data
}

export function clearPdfCache(): void {
  pdfDocCache.clear()
}

export function evictPdfCache(sourceFileIds: string[]): void {
  for (const sourceFileId of sourceFileIds) {
    pdfDocCache.delete(sourceFileId)
  }
}

type PdfJsOutlineItem = {
  title?: string
  dest?: unknown
  items?: PdfJsOutlineItem[]
}

type PdfJsRefProxy = {
  num: number
  gen: number
}

async function extractPdfOutline(pdfDoc: PDFDocumentProxy): Promise<PdfOutlineNode[]> {
  try {
    const outline = await pdfDoc.getOutline()
    if (!outline || outline.length === 0) return []
    return await mapItems(pdfDoc, outline)
  } catch (error) {
    console.warn('Failed to read PDF outline', error)
    return []
  }
}

async function mapItems(
  pdfDoc: PDFDocumentProxy,
  items: PdfJsOutlineItem[],
): Promise<PdfOutlineNode[]> {
  const nodes: PdfOutlineNode[] = []

  for (const item of items) {
    const children = await mapItems(pdfDoc, item.items ?? [])
    const pageIndex = await resolvePageIndex(pdfDoc, item.dest)

    if (pageIndex == null) {
      if (children.length) nodes.push(...children)
      continue
    }

    const title = typeof item.title === 'string' ? item.title.trim() : ''

    nodes.push({
      title: title || 'Untitled',
      pageIndex,
      children: children.length ? children : undefined,
    })
  }

  return nodes
}

async function resolvePageIndex(pdfDoc: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  if (!dest) return null

  let resolved: unknown = dest
  if (typeof dest === 'string') {
    resolved = await pdfDoc.getDestination(dest)
  }

  if (!Array.isArray(resolved) || resolved.length === 0) return null

  const pageRef = resolved[0]
  if (typeof pageRef === 'number') {
    return pageRef >= 0 ? pageRef : null
  }
  if (typeof pageRef !== 'object' || pageRef === null) {
    return null
  }

  try {
    const idx = await pdfDoc.getPageIndex(pageRef as PdfJsRefProxy)
    return idx >= 0 ? idx : null
  } catch {
    return null
  }
}

async function convertImageToPdf(file: File): Promise<{
  success: boolean
  file?: File
  error?: string
  errorCode?: ImportErrorCode
}> {
  try {
    const pdfDoc = await PDFDocument.create()
    const arrayBuffer = await file.arrayBuffer()

    let image
    const filename = file.name.toLowerCase()

    if (file.type === 'image/jpeg' || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      image = await pdfDoc.embedJpg(arrayBuffer)
    } else if (file.type === 'image/png' || filename.endsWith('.png')) {
      image = await pdfDoc.embedPng(arrayBuffer)
    } else {
      throw new Error('Unsupported image format. Use JPG or PNG.')
    }

    const page = pdfDoc.addPage([image.width, image.height])
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    })

    const pdfBytes = await pdfDoc.save()
    const pdfFile = new File([pdfBytes as BlobPart], `${file.name}.pdf`, {
      type: 'application/pdf',
    })

    return { success: true, file: pdfFile }
  } catch (error) {
    console.error('Image conversion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image conversion failed',
      errorCode: 'IMPORT_IMAGE_CONVERSION_FAILED',
    }
  }
}
