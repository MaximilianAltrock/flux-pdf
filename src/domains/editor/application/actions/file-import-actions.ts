import type { ImportService } from '@/domains/import/application/import-service'
import { importPdf as importPdfUseCase } from '@/domains/import/application/use-cases/import-pdf'
import { getImportErrorMessage } from '@/domains/import/domain/errors'

interface FileImportToast {
  success: (title: string, detail?: string) => unknown
  error: (title: string, detail?: string) => unknown
}

export interface CreateFileImportActionsDeps {
  toast: FileImportToast
  openFileDialog: () => void
  clearFileInput: () => void
  services: Pick<ImportService, 'importFiles'>
}

export function createFileImportActions({
  toast,
  openFileDialog,
  clearFileInput,
  services,
}: CreateFileImportActionsDeps) {
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
    handleMobileAddFiles,
    handleMobileTakePhoto,
  }
}
