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

// Track if WASM is loaded
let wasmLoaded = false
let currentResolve: ((data: ArrayBuffer) => void) | null = null
let currentReject: ((error: Error) => void) | null = null

/**
 * Load the Ghostscript WASM module
 */
function loadGhostscript() {
  if (!wasmLoaded) {
    importScripts('/gs/gs-worker.js')
    wasmLoaded = true
  }
}

/**
 * Compress a PDF using Ghostscript
 */
function compressPdf(pdfData: ArrayBuffer, quality: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    currentResolve = resolve
    currentReject = reject

    const qualitySetting = QUALITY_PRESETS[quality] || QUALITY_PRESETS.ebook

    // Set up Emscripten Module configuration
    const moduleConfig = {
      preRun: [
        function () {
          // Write input PDF to virtual filesystem
          ;(self as any).Module.FS.writeFile('input.pdf', new Uint8Array(pdfData))
        },
      ],
      postRun: [
        function () {
          try {
            // Read compressed output from virtual filesystem
            const outputData = (self as any).Module.FS.readFile('output.pdf', {
              encoding: 'binary',
            })
            const arrayBuffer = outputData.buffer.slice(
              outputData.byteOffset,
              outputData.byteOffset + outputData.byteLength,
            )
            if (currentResolve) {
              currentResolve(arrayBuffer)
            }
          } catch (_err) {
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
      totalDependencies: 0,
      noExitRuntime: 1,
    }

    // Check if Module already exists (subsequent runs)
    if (!(self as any).Module) {
      ;(self as any).Module = moduleConfig
      loadGhostscript()
    } else {
      // Reset for subsequent compressions
      ;(self as any).Module.calledRun = false
      ;(self as any).Module.postRun = moduleConfig.postRun
      ;(self as any).Module.preRun = moduleConfig.preRun
      ;(self as any).Module.arguments = moduleConfig.arguments
      ;(self as any).Module.callMain()
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
    self.postMessage({ type: 'progress', progress: 10 })

    const compressedData = await compressPdf(data, quality || 'ebook')

    // Send result back to main thread
    self.postMessage({ type: 'result', data: compressedData }, { transfer: [compressedData] })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Compression failed'
    self.postMessage({ type: 'error', error: errorMessage })
  }
})

// Signal that worker is ready
self.postMessage({ type: 'ready' })
