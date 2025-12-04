import { ref } from 'vue'
import { usePdfManager } from './usePdfManager'
import type { PageReference } from '@/types'

/**
 * LRU Cache for thumbnail blob URLs
 */
class ThumbnailCache {
  private cache = new Map<string, { url: string; lastAccessed: number }>()
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  /**
   * Generate cache key from page reference
   */
  private getKey(pageRef: PageReference, width: number): string {
    return `${pageRef.sourceFileId}-${pageRef.sourcePageIndex}-${pageRef.rotation}-${width}`
  }

  get(pageRef: PageReference, width: number): string | null {
    const key = this.getKey(pageRef, width)
    const entry = this.cache.get(key)

    if (entry) {
      entry.lastAccessed = Date.now()
      return entry.url
    }

    return null
  }

  set(pageRef: PageReference, width: number, url: string): void {
    const key = this.getKey(pageRef, width)

    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
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
const thumbnailCache = new ThumbnailCache(100)

/**
 * Composable for rendering PDF page thumbnails
 */
export function useThumbnailRenderer() {
  const pdfManager = usePdfManager()
  const renderQueue = ref<Map<string, AbortController>>(new Map())

  /**
   * Render a PDF page to a canvas and return a blob URL
   *
   * @param pageRef - The page reference to render
   * @param displayWidth - The CSS display width (actual render will be higher for sharpness)
   * @param scaleFactor - Multiplier for render resolution (default 3x for crisp text)
   */
  async function renderThumbnail(
    pageRef: PageReference,
    displayWidth = 200,
    scaleFactor = 2,
  ): Promise<string> {
    // Check cache first
    const cached = thumbnailCache.get(pageRef, displayWidth)
    if (cached) {
      return cached
    }

    // Create abort controller for this render
    const abortController = new AbortController()
    renderQueue.value.set(pageRef.id, abortController)

    try {
      // Get the PDF document
      const pdfDoc = await pdfManager.getPdfDocument(pageRef.sourceFileId)

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Render aborted')
      }

      // Get the page (PDF.js uses 1-based indexing)
      const page = await pdfDoc.getPage(pageRef.sourcePageIndex + 1)

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
      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise

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
      thumbnailCache.set(pageRef, displayWidth, url)

      return url
    } finally {
      renderQueue.value.delete(pageRef.id)
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
  }

  /**
   * Cancel all pending renders
   */
  function cancelAllRenders(): void {
    for (const controller of renderQueue.value.values()) {
      controller.abort()
    }
    renderQueue.value.clear()
  }

  /**
   * Clear the thumbnail cache
   */
  function clearCache(): void {
    thumbnailCache.clear()
  }

  /**
   * Invalidate cache for a specific page (e.g., after rotation)
   */
  function invalidatePage(pageRef: PageReference): void {
    // The cache key includes rotation, so rotating will automatically
    // cause a cache miss. But if you want to force re-render:
    // thumbnailCache.delete(pageRef)
  }

  return {
    renderThumbnail,
    cancelRender,
    cancelAllRenders,
    clearCache,
    invalidatePage,
  }
}
