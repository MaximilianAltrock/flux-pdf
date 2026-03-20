import { createCommandActions } from '@/domains/editor/application/actions/command-actions'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { PageReference } from '@/shared/types'
import type { RotationDelta } from '@/shared/constants'

export interface UseEditorShellActionGroupDeps {
  store: Pick<
    DocumentState,
    'selection' | 'contentPages' | 'selectedCount' | 'selectPage' | 'selectAll'
  >
  ui: Pick<EditorUiState, 'closeCommandPalette' | 'zoomIn' | 'zoomOut'>
  openFileDialog: () => void
  handlePagePreview: (pageRef: PageReference) => void
  handleDuplicateSelected: () => void
  handleRotateSelected: (degrees: RotationDelta) => void
  handleExportSelected: () => void
  handleDeleteSelected: () => void | Promise<void>
  handleDiffSelected: () => void
  handleExport: () => void | Promise<void>
  handleNewProject: () => void | Promise<void>
}

export function useEditorShellActionGroup({
  ui,
  ...deps
}: UseEditorShellActionGroupDeps) {
  const commandActions = createCommandActions({
    ui,
    ...deps,
  })

  return {
    ...commandActions,
    zoomIn: ui.zoomIn,
    zoomOut: ui.zoomOut,
  }
}
