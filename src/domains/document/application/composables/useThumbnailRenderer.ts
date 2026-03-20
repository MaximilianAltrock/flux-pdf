import { PDF_PAGE_INDEX_BASE, THUMBNAIL } from '@/shared/constants'
import { usePdfRepository } from '@/shared/infrastructure/pdf.repository'
import type { PageReference } from '@/shared/types'
import { sharedRenderedThumbnailCache } from '@/shared/infrastructure/thumbnail-cache'

export function getRenderedThumbnailCacheKey(
  pageRef: PageReference,
  displayWidth: number,
  scaleFactor: number,
): string {
  return `render:${pageRef.sourceFileId}:${pageRef.sourcePageIndex}:${pageRef.rotation}:${displayWidth}:${scaleFactor}`
}

/**
 * Composable for rendering PDF page thumbnails
 */
export function useThumbnailRenderer() {
  const { getPdfDocument } = usePdfRepository()

  /**
   * Render a PDF page to a canvas and return a blob URL
   *
   * @param pageRef - The page reference to render
   * @param displayWidth - The CSS display width (actual render will be higher for sharpness)
   * @param scaleFactor - Multiplier for render resolution (default 3x for crisp text)
   */
  async function renderThumbnail(
    pageRef: PageReference,
    displayWidth: number = THUMBNAIL.DEFAULT_WIDTH,
    scaleFactor: number = THUMBNAIL.SCALE_FACTOR,
  ): Promise<string> {
    const cacheKey = getRenderedThumbnailCacheKey(pageRef, displayWidth, scaleFactor)
    const blob = await renderThumbnailBlob(pageRef, displayWidth, scaleFactor)
    return sharedRenderedThumbnailCache.retainUrl(cacheKey, blob)
  }

  async function renderThumbnailBlob(
    pageRef: PageReference,
    displayWidth: number = THUMBNAIL.DEFAULT_WIDTH,
    scaleFactor: number = THUMBNAIL.SCALE_FACTOR,
  ): Promise<Blob> {
    const cacheKey = getRenderedThumbnailCacheKey(pageRef, displayWidth, scaleFactor)
    return sharedRenderedThumbnailCache.getBlob(cacheKey, async () => {
      const pdfDoc = await getPdfDocument(pageRef.sourceFileId)
      const page = await pdfDoc.getPage(pageRef.sourcePageIndex + PDF_PAGE_INDEX_BASE)
      const renderWidth = displayWidth * scaleFactor
      const viewport = page.getViewport({ scale: 1, rotation: pageRef.rotation })
      const scale = renderWidth / viewport.width
      const scaledViewport = page.getViewport({ scale, rotation: pageRef.rotation })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!

      canvas.width = Math.floor(scaledViewport.width)
      canvas.height = Math.floor(scaledViewport.height)

      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport: scaledViewport,
      })

      await renderTask.promise

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
          'image/png',
        )
      })
    })
  }

  async function getPageViewportSize(
    pageRef: PageReference,
  ): Promise<{ width: number; height: number } | null> {
    try {
      const pdfDoc = await getPdfDocument(pageRef.sourceFileId)
      const page = await pdfDoc.getPage(pageRef.sourcePageIndex + PDF_PAGE_INDEX_BASE)
      const viewport = page.getViewport({ scale: 1, rotation: pageRef.rotation })

      if (!viewport?.width || !viewport?.height) return null
      return { width: viewport.width, height: viewport.height }
    } catch {
      return null
    }
  }

  function releaseThumbnail(
    pageRef: PageReference,
    displayWidth: number = THUMBNAIL.DEFAULT_WIDTH,
    scaleFactor: number = THUMBNAIL.SCALE_FACTOR,
  ): void {
    sharedRenderedThumbnailCache.releaseUrl(
      getRenderedThumbnailCacheKey(pageRef, displayWidth, scaleFactor),
    )
  }

  /**
   * Clear the thumbnail cache
   */
  function clearCache(): void {
    sharedRenderedThumbnailCache.clear()
  }

  return {
    renderThumbnail,
    renderThumbnailBlob,
    getPageViewportSize,
    releaseThumbnail,
    clearCache,
  }
}
