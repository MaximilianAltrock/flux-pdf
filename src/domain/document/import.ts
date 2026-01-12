import * as pdfjs from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import { db } from '@/db/db'
import type {
  DocumentMetadata,
  FileUploadResult,
  PageReference,
  PdfOutlineNode,
  SourceFile,
} from '@/types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * PDF cache: Parsed docs in RAM, raw buffers in IndexedDB.
 */
const pdfDocCache = new Map<string, PDFDocumentProxy>()

const PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#06b6d4']

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

export interface LoadPdfFileOptions {
  colorIndex: number
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

    await db.files.add({
      id: sourceFileId,
      data: arrayBuffer,
      filename: file.name,
      fileSize: file.size,
      pageCount: pdfDoc.numPages,
      addedAt,
      color,
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
      outline: outline.length ? outline : undefined,
      metadata: extractedMetadata ?? undefined,
    }

    pdfDocCache.set(sourceFileId, pdfDoc)

    const groupId = crypto.randomUUID()
    const pageRefs: PageReference[] = []
    for (let i = 0; i < pdfDoc.numPages; i++) {
      pageRefs.push({
        id: crypto.randomUUID(),
        sourceFileId,
        sourcePageIndex: i,
        rotation: 0,
        groupId,
      })
    }

    return { success: true, sourceFile, pageRefs }
  } catch (error) {
    console.error('Failed to load PDF file:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
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
      results.push(await loadPdfFile(file, { colorIndex }))
      colorIndex++
    } else if (file.type.startsWith('image/')) {
      const conversion = await convertImageToPdf(file)
      if (conversion.success && conversion.file) {
        results.push(await loadPdfFile(conversion.file, { colorIndex }))
        colorIndex++
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

type PdfJsOutlineItem = {
  title?: string
  dest?: unknown
  items?: PdfJsOutlineItem[]
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

  try {
    const idx = await pdfDoc.getPageIndex(pageRef as any)
    return idx >= 0 ? idx : null
  } catch {
    return null
  }
}

async function convertImageToPdf(file: File): Promise<{ success: boolean; file?: File }> {
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
    }
  }
}
