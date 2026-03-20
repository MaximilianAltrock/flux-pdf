import type { Ref } from 'vue'
import { TIMEOUTS_MS } from '@/shared/constants'
import { exportPdf as exportPdfUseCase } from '@/domains/export/application/use-cases/export-pdf'
import type {
  ProjectSessionServices,
  ExportOptions,
} from '@/domains/project-session/application/create-project-session-services'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { ExportOperationState } from '@/domains/export/session/export-operation.state'
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
  store: DocumentState
  ui: Pick<EditorUiState, 'setLoading'>
  exportState: Pick<ExportOperationState, 'openExportModal'>
  toast: FileExportToast
  mobile: FileExportMobile
  blurActiveElement: () => void
  services: Pick<
    ProjectSessionServices,
    'generateRawPdf' | 'exportDocument' | 'parsePageRange'
  >
}

export function createFileExportActions({
  store,
  ui,
  exportState,
  toast,
  mobile,
  blurActiveElement,
  services,
}: CreateFileExportActionsDeps) {
  const { isMobile, canShareFiles, haptic, shareFile } = mobile

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

  return {
    exportDocument,
    handleExport,
    handleExportSelected,
    handleExportSuccess,
    openExportOptions,
  }
}
