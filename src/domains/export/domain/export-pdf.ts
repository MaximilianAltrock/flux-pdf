import { PDFDocument, degrees, type PDFPage } from 'pdf-lib'
import { EXPORT_PROGRESS, PDF_PAGE_INDEX_BASE } from '@/shared/constants'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageReference, RedactionMark } from '@/shared/types'
import { applyExportMetadata } from '@/domains/export/domain/export-metadata'
import {
  addBookmarks,
  applyExpandedState,
  flattenExportBookmarks,
  mapBookmarksToExport,
} from '@/domains/export/domain/export-bookmarks'
import type { GenerateRawPdfOptions } from '@/domains/export/domain/export-types'

const DEFAULT_BURN_SCALE = 2

export async function generateRawPdf(
  pages: PageReference[],
  options: GenerateRawPdfOptions,
): Promise<Uint8Array> {
  const {
    metadata,
    compress,
    onProgress,
    getPdfBlob,
    getPdfDocument,
    burnScale,
    bookmarks,
    pageIdToDocIndex,
    outline,
  } = options

  const finalPdf = await PDFDocument.create()
  applyExportMetadata(finalPdf, metadata)

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
  let exportIndex = 0
  for (const page of pages) {
    if (page.isDivider) continue
    pageIdToIndex.set(page.id, exportIndex++)
  }

  if (outline?.include !== false) {
    let exportBookmarks = mapBookmarksToExport(
      bookmarks ?? [],
      pageIdToIndex,
      pageIdToDocIndex,
    )
    if (outline?.flatten) {
      exportBookmarks = flattenExportBookmarks(exportBookmarks)
    }
    if (outline?.expandAll) {
      exportBookmarks = applyExpandedState(exportBookmarks, true)
    }
    await addBookmarks(finalPdf, exportBookmarks)
  }

  return await finalPdf.save({
    useObjectStreams: compress ?? false,
    addDefaultPage: false,
  })
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
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Failed to create redaction blob'))),
      'image/png',
    )
  })

  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { bytes, width: viewport.width, height: viewport.height }
}

function fitContentToPage(
  content: { width: number; height: number },
  target?: { width: number; height: number } | null,
): {
  pageWidth: number
  pageHeight: number
  drawWidth: number
  drawHeight: number
  offsetX: number
  offsetY: number
} {
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

  return {
    pageWidth,
    pageHeight,
    drawWidth,
    drawHeight,
    offsetX: (pageWidth - drawWidth) / 2,
    offsetY: (pageHeight - drawHeight) / 2,
  }
}
