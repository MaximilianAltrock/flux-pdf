import { ref } from 'vue'
import { PDF_PAGE_INDEX_BASE, THUMBNAIL } from '@/constants'
import { usePdfRepository } from '@/services/pdfRepository'
import type { PageReference } from '@/types'

/**
 * LRU Cache for thumbnail blob URLs
 */
class ThumbnailCache {
  private cache = new Map<string, { url: string; lastAccessed: number }>()
  private maxSize: number

  constructor(maxSize = THUMBNAIL.CACHE_MAX) {
    this.maxSize = maxSize
  }

  /**
   * Generate cache key from page reference
   */
  private getKey(pageRef: PageReference, width: number, scaleFactor: number): string {
    return `${pageRef.sourceFileId}-${pageRef.sourcePageIndex}-${pageRef.rotation}-${width}-${scaleFactor}`
  }

  get(pageRef: PageReference, width: number, scaleFactor: number): string | null {
    const key = this.getKey(pageRef, width, scaleFactor)
    const entry = this.cache.get(key)

    if (entry) {
      entry.lastAccessed = Date.now()
      return entry.url
    }

    return null
  }

  set(pageRef: PageReference, width: number, scaleFactor: number, url: string): void {
    const key = this.getKey(pageRef, width, scaleFactor)
    const existing = this.cache.get(key)

    if (existing) {
      URL.revokeObjectURL(existing.url)
    } else if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, { url, lastAccessed: Date.now() })
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)
      if (entry) {
        URL.revokeObjectURL(entry.url)
      }
      this.cache.delete(oldestKey)
    }
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url)
    }
    this.cache.clear()
  }
}

// Global thumbnail cache (fewer items since they're higher resolution)
const thumbnailCache = new ThumbnailCache(THUMBNAIL.CACHE_MAX)

/**
 * Composable for rendering PDF page thumbnails
 */
export function useThumbnailRenderer() {
  const { getPdfDocument } = usePdfRepository()
  const renderQueue = ref<Map<string, AbortController>>(new Map())
  const renderTasks = new Map<string, { cancel: () => void }>()

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
    // Check cache first
    const cached = thumbnailCache.get(pageRef, displayWidth, scaleFactor)
    if (cached) {
      return cached
    }

    // Create abort controller for this render
    const abortController = new AbortController()
    renderQueue.value.set(pageRef.id, abortController)

    try {
      // Get the PDF document
      const pdfDoc = await getPdfDocument(pageRef.sourceFileId)

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Render aborted')
      }

      // Get the page (PDF.js uses 1-based indexing)
      const page = await pdfDoc.getPage(pageRef.sourcePageIndex + PDF_PAGE_INDEX_BASE)

      const renderWidth = displayWidth * scaleFactor

      const viewport = page.getViewport({ scale: 1, rotation: pageRef.rotation })
      const scale = renderWidth / viewport.width
      const scaledViewport = page.getViewport({ scale, rotation: pageRef.rotation })

      // Create canvas at high resolution
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!

      canvas.width = Math.floor(scaledViewport.width)
      canvas.height = Math.floor(scaledViewport.height)

      // Render at high resolution
      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport: scaledViewport,
      })

      renderTasks.set(pageRef.id, renderTask)

      if (abortController.signal.aborted) {
        renderTask.cancel()
        throw new Error('Render aborted')
      }

      await renderTask.promise

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Render aborted')
      }

      // Convert to blob URL with good quality
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
          'image/png',
        )
      })

      const url = URL.createObjectURL(blob)

      // Cache it
      thumbnailCache.set(pageRef, displayWidth, scaleFactor, url)

      return url
    } finally {
      renderQueue.value.delete(pageRef.id)
      renderTasks.delete(pageRef.id)
    }
  }

  /**
   * Cancel a pending render
   */
  function cancelRender(pageRefId: string): void {
    const controller = renderQueue.value.get(pageRefId)
    if (controller) {
      controller.abort()
      renderQueue.value.delete(pageRefId)
    }

    const task = renderTasks.get(pageRefId)
    task?.cancel()
    renderTasks.delete(pageRefId)
  }

  /**
   * Cancel all pending renders
   */
  function cancelAllRenders(): void {
    for (const controller of renderQueue.value.values()) {
      controller.abort()
    }
    renderQueue.value.clear()

    for (const task of renderTasks.values()) {
      task.cancel()
    }
    renderTasks.clear()
  }

  /**
   * Clear the thumbnail cache
   */
  function clearCache(): void {
    thumbnailCache.clear()
  }

  return {
    renderThumbnail,
    cancelRender,
    cancelAllRenders,
    clearCache,
  }
}
