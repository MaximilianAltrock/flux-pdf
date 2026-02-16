import type { Ref } from 'vue'
import { TIMEOUTS_MS } from '@/shared/constants'
import { importPdf as importPdfUseCase, exportPdf as exportPdfUseCase } from '@/domains/document/application/use-cases'
import { getImportErrorMessage } from '@/domains/document/domain/errors'
import type {
  DocumentService,
  ExportOptions,
} from '@/domains/document/application/document.service'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { useExportStore } from '@/domains/export/store/export.store'
import type { PageReference } from '@/shared/types'

interface FileExportToast {
  success: (title: string, detail?: string) => unknown
  warning: (title: string, detail?: string, durationMs?: number) => unknown
  error: (title: string, detail?: string) => unknown
}

interface FileExportMobile {
  isMobile: Ref<boolean>
  canShareFiles: Ref<boolean>
  haptic: (pattern: 'light' | 'medium' | 'heavy' | 'success') => void
  shareFile: (file: File, title?: string) => Promise<{ shared: boolean; downloaded: boolean }>
}

export interface CreateFileExportActionsDeps {
  store: ReturnType<typeof useDocumentStore>
  ui: Pick<ReturnType<typeof useUiStore>, 'setLoading'>
  exportState: Pick<ReturnType<typeof useExportStore>, 'openExportModal'>
  toast: FileExportToast
  mobile: FileExportMobile
  openFileDialog: () => void
  clearFileInput: () => void
  blurActiveElement: () => void
  services: Pick<
    DocumentService,
    'importFiles' | 'generateRawPdf' | 'exportDocument' | 'parsePageRange'
  >
}

export function createFileExportActions({
  store,
  ui,
  exportState,
  toast,
  mobile,
  openFileDialog,
  clearFileInput,
  blurActiveElement,
  services,
}: CreateFileExportActionsDeps) {
  const { isMobile, canShareFiles, haptic, shareFile } = mobile

  async function handleImport(files: FileList | File[], options: { addPages: boolean }) {
    const result = await importPdfUseCase(
      { importFiles: services.importFiles },
      files,
      { addPages: options.addPages },
    )
    if (!result.ok) {
      toast.error('Failed to load files', result.error.message)
      return
    }

    const { successes, errors, totalPages } = result.value

    if (successes.length > 0) {
      if (options.addPages) {
        toast.success(
          `Added ${successes.length} file${successes.length > 1 ? 's' : ''}`,
          `${totalPages} page${totalPages > 1 ? 's' : ''} added`,
        )
      } else {
        toast.success(
          `Registered ${successes.length} source file${successes.length > 1 ? 's' : ''}`,
          `${totalPages} page${totalPages > 1 ? 's' : ''} ready to add`,
        )
      }
    }

    if (errors.length > 0) {
      const detail = errors
        .map((entry) => {
          if (entry.errorCode) {
            return getImportErrorMessage(entry.errorCode, entry.error)
          }
          return entry.error
        })
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        .join(', ')

      toast.error(
        `Failed to load ${errors.length} file${errors.length > 1 ? 's' : ''}`,
        detail || 'Unknown error',
      )
    }
  }

  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      handleImport(input.files, { addPages: true })
      clearFileInput()
    }
  }

  async function handleFilesSelected(files: FileList) {
    await handleImport(files, { addPages: true })
  }

  async function handleSourcesSelected(files: FileList) {
    await handleImport(files, { addPages: false })
  }

  function getExportPagesForWarning(options: ExportOptions): PageReference[] {
    if (options.pageRange) {
      const indices = services.parsePageRange(options.pageRange, store.contentPageCount)
      return indices.map((i) => store.contentPages[i]).filter((p): p is PageReference => !!p)
    }
    return store.contentPages
  }

  function warnIfRedactions(pages: PageReference[]) {
    const count = pages.reduce((sum, page) => sum + (page.redactions?.length ?? 0), 0)
    if (count <= 0) return
    const label = count === 1 ? '1 Redaction' : `${count} Redactions`
    toast.warning(
      `${label} applied. This data will be permanently removed.`,
      undefined,
      TIMEOUTS_MS.TOAST_WARNING,
    )
  }

  function downloadFile(data: Uint8Array, filename: string, mimeType: string): void {
    const arrayBuffer =
      data.buffer instanceof ArrayBuffer
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data.slice().buffer

    const blob = new Blob([arrayBuffer], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => URL.revokeObjectURL(url), TIMEOUTS_MS.OBJECT_URL_REVOKE)
  }

  async function exportDocument(options: ExportOptions) {
    warnIfRedactions(getExportPagesForWarning(options))
    const result = await exportPdfUseCase(
      { exportDocument: services.exportDocument },
      options,
    )
    if (!result.ok) return result

    downloadFile(result.value.bytes, result.value.filename, result.value.mimeType)
    return result
  }

  async function handleMobileExport() {
    try {
      ui.setLoading(true, 'Generating PDF...')

      const pagesToExport = store.contentPages
      if (pagesToExport.length === 0) {
        throw new Error('No pages to export')
      }
      warnIfRedactions(pagesToExport)

      const filename = store.projectTitle || 'document'
      const pdfResult = await services.generateRawPdf(pagesToExport, { compress: false })
      if (!pdfResult.ok) {
        throw new Error(pdfResult.error.message)
      }
      const pdfBytes = pdfResult.value
      const file = new File([pdfBytes as BlobPart], `${filename}.pdf`, {
        type: 'application/pdf',
      })

      ui.setLoading(false)

      const result = await shareFile(file, filename)
      if (result.shared) {
        toast.success('Shared successfully')
      } else if (result.downloaded) {
        toast.success('PDF downloaded')
      }
    } catch (error) {
      ui.setLoading(false)
      toast.error('Export failed', error instanceof Error ? error.message : 'Export failed')
    }
  }

  async function handleExport() {
    if (isMobile.value && canShareFiles.value) {
      await handleMobileExport()
    } else {
      openExportOptions(false)
    }
  }

  function handleExportSelected() {
    if (isMobile.value) {
      haptic('light')
    }
    openExportOptions(true)
  }

  function handleExportSuccess() {
    toast.success('PDF Exported')
  }

  function openExportOptions(selectedOnly = false) {
    blurActiveElement()
    exportState.openExportModal(selectedOnly)
  }

  function handleMobileAddFiles() {
    openFileDialog()
  }

  function handleMobileTakePhoto() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) handleImport(files, { addPages: true })
    }
    input.click()
  }

  return {
    handleFileInputChange,
    handleFilesSelected,
    handleSourcesSelected,
    exportDocument,
    handleExport,
    handleExportSelected,
    handleExportSuccess,
    openExportOptions,
    handleMobileAddFiles,
    handleMobileTakePhoto,
  }
}
