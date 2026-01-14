import { WORKER_PROGRESS, WORKER_RUNTIME } from '@/constants'

/**
 * Ghostscript PDF Compression Worker
 *
 * This worker handles PDF compression using Ghostscript compiled to WASM.
 * It runs in a separate thread to keep the UI responsive.
 *
 * Message API:
 * - Input: { type: 'compress', data: ArrayBuffer, quality: string }
 * - Output: { type: 'result', data: ArrayBuffer } | { type: 'error', error: string } | { type: 'progress', progress: number }
 */

// Web Worker global function declaration
declare function importScripts(...urls: string[]): void

// Quality presets for Ghostscript
const QUALITY_PRESETS: Record<string, string> = {
  screen: '/screen', // Lowest quality, max compression (72 dpi)
  ebook: '/ebook', // Medium quality (150 dpi)
  printer: '/printer', // High quality (300 dpi)
  prepress: '/prepress', // Highest quality, minimal compression (300 dpi, color preserving)
}

// Emscripten Module type declaration (used globally by gs-worker.js)
type _GsModule = {
  FS: {
    writeFile: (name: string, data: Uint8Array) => void
    readFile: (name: string, opts?: { encoding: string }) => Uint8Array
  }
  calledRun: boolean
  callMain: () => void
  preRun: Array<() => void>
  postRun: Array<() => void>
  arguments: string[]
  print: (text: string) => void
  printErr: (text: string) => void
  totalDependencies: number
  noExitRuntime: number
}

type GsModuleConfig = Pick<
  _GsModule,
  'preRun' | 'postRun' | 'arguments' | 'print' | 'printErr' | 'totalDependencies' | 'noExitRuntime'
>

type GsModuleLike = _GsModule | GsModuleConfig

const moduleContext = self as unknown as { Module?: GsModuleLike }

// Track if WASM is loaded
let wasmLoaded = false
let currentResolve: ((data: ArrayBuffer) => void) | null = null
let currentReject: ((error: Error) => void) | null = null

/**
 * Load the Ghostscript WASM module
 */
function loadGhostscript(baseUrl: string) {
  if (!wasmLoaded) {
    // Ensure baseUrl ends with / if it doesn't (though Vite usually provides it with trailing slash)
    const safeBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const workerUrl = `${safeBaseUrl}gs/gs-worker.js`

    console.log(`[Compression Worker] Loading Ghostscript from: ${workerUrl}`)

    try {
      importScripts(workerUrl)
      wasmLoaded = true
    } catch (e) {
      console.error('[Compression Worker] Failed to load Ghostscript:', e)
      throw new Error(`Failed to load Ghostscript from ${workerUrl}`)
    }
  }
}

/**
 * Compress a PDF using Ghostscript
 */
function compressPdf(
  pdfData: ArrayBuffer | SharedArrayBuffer,
  quality: string,
  baseUrl: string,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    currentResolve = resolve
    currentReject = reject

    const qualitySetting = QUALITY_PRESETS[quality] || QUALITY_PRESETS.ebook

    // Set up Emscripten Module configuration
    const moduleConfig: GsModuleConfig = {
      preRun: [
        function () {
          // Write input PDF to virtual filesystem
          const module = moduleContext.Module as _GsModule
          module.FS.writeFile('input.pdf', new Uint8Array(pdfData))
        },
      ],
      postRun: [
        function () {
          try {
            // Read compressed output from virtual filesystem
            const module = moduleContext.Module as _GsModule
            const outputData = module.FS.readFile('output.pdf', {
              encoding: 'binary',
            })
            const arrayBuffer = outputData.buffer.slice(
              outputData.byteOffset,
              outputData.byteOffset + outputData.byteLength,
            ) as ArrayBuffer
            if (currentResolve) {
              currentResolve(arrayBuffer)
            }
          } catch {
            if (currentReject) {
              currentReject(new Error('Failed to read compressed PDF output'))
            }
          }
        },
      ],
      arguments: [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-dPDFSETTINGS=${qualitySetting}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',

        '-sOutputFile=output.pdf',
        '-dPreserveAnnots=true',
        'input.pdf',
      ],
      print: function (_text: string) {
        // Suppress stdout
      },
      printErr: function (_text: string) {
        // Suppress stderr
      },
      totalDependencies: WORKER_RUNTIME.TOTAL_DEPENDENCIES,
      noExitRuntime: WORKER_RUNTIME.NO_EXIT_RUNTIME,
    }

    // Check if Module already exists (subsequent runs)
    if (!moduleContext.Module) {
      moduleContext.Module = moduleConfig
      try {
        loadGhostscript(baseUrl)
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
        return
      }
    } else {
      const module = moduleContext.Module as _GsModule
      // Reset for subsequent compressions
      module.calledRun = false
      module.postRun = moduleConfig.postRun
      module.preRun = moduleConfig.preRun
      module.arguments = moduleConfig.arguments
      module.callMain()
    }
  })
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, data, quality } = event.data

  if (type !== 'compress') {
    return
  }

  try {
    // Notify start
    self.postMessage({ type: 'progress', progress: WORKER_PROGRESS.START })

    const compressedData = await compressPdf(data, quality || 'ebook', event.data.baseUrl)

    // Send result back to main thread
    self.postMessage({ type: 'result', data: compressedData }, { transfer: [compressedData] })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Compression failed'
    self.postMessage({ type: 'error', error: errorMessage })
  }
})

// Signal that worker is ready
self.postMessage({ type: 'ready' })
