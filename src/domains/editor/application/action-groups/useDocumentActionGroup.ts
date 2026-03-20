import type { Ref } from 'vue'
import { useSourceDropHandlers } from '@/domains/document/application/composables/useSourceDropHandlers'
import { createMetadataActions } from '@/domains/editor/application/actions/metadata-actions'
import { createOutlineActions } from '@/domains/editor/application/actions/outline-actions'
import { createPageActions } from '@/domains/editor/application/actions/page-actions'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { HistorySession } from '@/domains/history/session/create-history-session'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'

interface DocumentActionToast {
  success: (
    title: string,
    detail?: string,
    action?: { label: string; onClick: () => void },
  ) => unknown
  warning: (title: string, detail?: string, durationMs?: number) => unknown
}

export interface UseDocumentActionGroupDeps {
  store: DocumentState
  history: HistorySession
  ui: EditorUiState
  toast: DocumentActionToast
  isMobile: Ref<boolean>
  haptic: (pattern: 'light' | 'medium' | 'heavy' | 'success') => void
  confirmDelete: (itemCount: number, itemName?: string) => Promise<boolean>
  normalizeProjectTitle: (value: string) => string
}

export function useDocumentActionGroup({
  store,
  history,
  ui,
  toast,
  isMobile,
  haptic,
  confirmDelete,
  normalizeProjectTitle,
}: UseDocumentActionGroupDeps) {
  const sourceDropHandlers = useSourceDropHandlers({
    store,
    history,
  })

  const outlineActions = createOutlineActions({
    store,
    history,
    ui,
    toast,
  })

  const pageActions = createPageActions({
    store,
    history,
    ui,
    toast,
    isMobile,
    haptic,
    confirmDelete,
  })

  const metadataActions = createMetadataActions({
    store,
    ui,
    normalizeProjectTitle,
  })

  return {
    ...sourceDropHandlers,
    ...outlineActions,
    ...pageActions,
    ...metadataActions,
  }
}
