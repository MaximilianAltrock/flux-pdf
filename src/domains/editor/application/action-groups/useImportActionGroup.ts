import { createFileImportActions } from '@/domains/editor/application/actions/file-import-actions'
import type { ProjectSessionServices } from '@/domains/project-session/application/create-project-session-services'

interface ImportActionToast {
  success: (title: string, detail?: string) => unknown
  error: (title: string, detail?: string) => unknown
}

export interface UseImportActionGroupDeps {
  toast: ImportActionToast
  openFileDialog: () => void
  clearFileInput: () => void
  services: Pick<ProjectSessionServices, 'importFiles'>
}

export function useImportActionGroup({
  toast,
  openFileDialog,
  clearFileInput,
  services,
}: UseImportActionGroupDeps) {
  return createFileImportActions({
    toast,
    openFileDialog,
    clearFileInput,
    services,
  })
}
