import { shallowRef } from 'vue'
import { PROGRESS, TIMEOUTS_MS } from '@/constants'

/**
 * Compression quality presets
 * - screen: Lowest quality, maximum compression (72 dpi)
 * - ebook: Medium quality, good compression (150 dpi) - DEFAULT
 * - printer: High quality, moderate compression (300 dpi)
 * - prepress: Highest quality, minimal compression (300 dpi, color preserving)
 */
export type CompressionQuality = 'screen' | 'ebook' | 'printer' | 'prepress'

export interface CompressionOptions {
  quality?: CompressionQuality
}

export interface CompressionResult {
  data: Uint8Array
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

/**
 * Composable for PDF compression using Ghostscript WASM
 *
 * The compression runs in a Web Worker to keep the UI responsive.
 * The WASM binary (~14MB) is loaded on first use.
 */
export function usePdfCompression() {
  const isCompressing = shallowRef(false)
  const compressionProgress = shallowRef<number>(PROGRESS.MIN)
  const compressionError = shallowRef<string | null>(null)
  const isWorkerReady = shallowRef(false)

  // Keep worker reference for cleanup
  const workerRef = shallowRef<Worker | null>(null)

  /**
   * Create a new compression worker
   */
  function createWorker(): Worker {
    // Use Vite's worker import syntax for proper bundling
    const worker = new Worker(new URL('../workers/compression-worker.ts', import.meta.url), {
      type: 'module',
    })
    return worker
  }

  /**
   * Preload the worker and WASM module
   * Call this early to reduce compression latency on first use
   */
  function preloadWorker(): void {
    if (!workerRef.value) {
      workerRef.value = createWorker()
      workerRef.value.addEventListener('message', (e) => {
        if (e.data.type === 'ready') {
          isWorkerReady.value = true
        }
      })
    }
  }

  /**
   * Compress a PDF using Ghostscript
   *
   * @param pdfData - The PDF data to compress
   * @param options - Compression options (quality preset)
   * @returns Promise with compression result including original and compressed sizes
   */
  async function compressPdf(
    pdfData: Uint8Array,
    options: CompressionOptions = {},
  ): Promise<CompressionResult> {
    const { quality = 'ebook' } = options
    const originalSize = pdfData.byteLength

    isCompressing.value = true
    compressionProgress.value = PROGRESS.MIN
    compressionError.value = null

    return new Promise((resolve, reject) => {
      // Create a fresh worker for each compression to avoid state issues
      const worker = workerRef.value || createWorker()

      const cleanup = () => {
        worker.removeEventListener('message', handleMessage)
        worker.removeEventListener('error', handleError)
        // Terminate worker if it wasn't preloaded
        if (!workerRef.value) {
          setTimeout(() => worker.terminate(), TIMEOUTS_MS.WORKER_TERMINATE)
        }
        isCompressing.value = false
      }

      const handleMessage = (event: MessageEvent) => {
        const { type, data, progress, error } = event.data

        switch (type) {
          case 'ready':
            isWorkerReady.value = true
            break

          case 'progress':
            compressionProgress.value = progress
            break

          case 'result': {
            compressionProgress.value = PROGRESS.COMPLETE
            let compressedData = new Uint8Array(data)
            let compressedSize = compressedData.byteLength

            // Fallback if compression increased size
            if (compressedSize >= originalSize) {
              console.warn(
                `Compression increased file size (${originalSize} -> ${compressedSize}). Keeping original.`,
              )
              compressedData = pdfData
              compressedSize = originalSize
            }

            const compressionRatio = originalSize > 0 ? 1 - compressedSize / originalSize : 0

            cleanup()
            resolve({
              data: compressedData,
              originalSize,
              compressedSize,
              compressionRatio,
            })
            break
          }

          case 'error':
            if (import.meta.env.DEV) {
              console.error('[Compression] Worker error:', error)
            }
            compressionError.value = error
            cleanup()
            reject(new Error(error))
            break
        }
      }

      const handleError = (error: ErrorEvent) => {
        if (import.meta.env.DEV) {
          console.error('[Compression] Worker exception:', error)
        }
        compressionError.value = error.message || 'Worker error'
        cleanup()
        reject(new Error(error.message || 'Compression worker failed'))
      }

      worker.addEventListener('message', handleMessage)
      worker.addEventListener('error', handleError)

      // Convert Uint8Array to ArrayBuffer for transfer
      const buffer = pdfData.buffer.slice(
        pdfData.byteOffset,
        pdfData.byteOffset + pdfData.byteLength,
      )

      const locationBase =
        window.location.origin === 'null' ? window.location.href : window.location.origin
      const documentBase = document.baseURI ? new URL('.', document.baseURI).toString() : ''
      const baseUrl =
        documentBase || new URL(import.meta.env.BASE_URL, locationBase).toString()

      // Send compression request with transferable buffer
      worker.postMessage(
        {
          type: 'compress',
          data: buffer,
          quality,
          baseUrl,
        },
        { transfer: [buffer] },
      )
    })
  }

  /**
   * Cleanup worker on composable disposal
   */
  function dispose(): void {
    if (workerRef.value) {
      workerRef.value.terminate()
      workerRef.value = null
      isWorkerReady.value = false
    }
  }

  return {
    isCompressing,
    compressionProgress,
    compressionError,
    isWorkerReady,
    compressPdf,
    preloadWorker,
    dispose,
  }
}
