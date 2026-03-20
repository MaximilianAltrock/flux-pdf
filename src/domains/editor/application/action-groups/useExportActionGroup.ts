import { toRef, type Ref } from 'vue'
import { createFileExportActions } from '@/domains/editor/application/actions/file-export-actions'
import type {
  ExportOptions,
  ExportService,
} from '@/domains/export/application/export-service'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { ExportOperationState } from '@/domains/export/session/export-operation.state'

interface ExportActionToast {
  success: (title: string, detail?: string) => unknown
  warning: (title: string, detail?: string, durationMs?: number) => unknown
  error: (title: string, detail?: string) => unknown
}

interface ExportActionMobile {
  isMobile: Ref<boolean>
  canShareFiles: Ref<boolean>
  haptic: (pattern: 'light' | 'medium' | 'heavy' | 'success') => void
  shareFile: (file: File, title?: string) => Promise<{ shared: boolean; downloaded: boolean }>
}

export interface UseExportActionGroupDeps {
  store: DocumentState
  ui: Pick<EditorUiState, 'setLoading'>
  exportState: ExportOperationState
  toast: ExportActionToast
  mobile: ExportActionMobile
  blurActiveElement: () => void
  services: Pick<
    ExportService,
    | 'generateRawPdf'
    | 'exportDocument'
    | 'getSuggestedFilename'
    | 'getEstimatedSize'
    | 'clearExportError'
    | 'parsePageRange'
    | 'validatePageRange'
  >
}

export function useExportActionGroup({
  store,
  ui,
  exportState,
  toast,
  mobile,
  blurActiveElement,
  services,
}: UseExportActionGroupDeps) {
  const exportActions = createFileExportActions({
    store,
    ui,
    exportState,
    toast,
    mobile,
    blurActiveElement,
    services,
  })

  return {
    ...exportActions,
    exportJob: toRef(exportState, 'exportJob'),
    getSuggestedFilename: services.getSuggestedFilename,
    getEstimatedSize: services.getEstimatedSize,
    clearExportError: services.clearExportError,
    parsePageRange: services.parsePageRange,
    validatePageRange: services.validatePageRange,
  }
}

export type ExportActionGroup = ReturnType<typeof useExportActionGroup>
export type { ExportOptions }
