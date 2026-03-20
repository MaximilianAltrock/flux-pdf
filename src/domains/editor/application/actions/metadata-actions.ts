import { updateMetadata as updateMetadataUseCase } from '@/domains/document/application/use-cases'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { PrimaryEditorToolId } from '@/domains/editor/domain/types'
import type { DocumentMetadata, SecurityMetadata } from '@/shared/types'

export interface CreateMetadataActionsDeps {
  store: DocumentState
  ui: Pick<EditorUiState, 'setCurrentTool'>
  normalizeProjectTitle: (value: string) => string
}

export function createMetadataActions({
  store,
  ui,
  normalizeProjectTitle,
}: CreateMetadataActionsDeps) {
  function setProjectTitleDraft(value: string) {
    store.setProjectTitle(value)
  }

  function commitProjectTitle(value?: string) {
    store.setProjectTitle(normalizeProjectTitle(value ?? store.projectTitle))
  }

  function setCurrentTool(tool: PrimaryEditorToolId) {
    ui.setCurrentTool(tool)
  }

  function setMetadata(next: Partial<DocumentMetadata>) {
    updateMetadataUseCase(store, next)
  }

  function applyMetadataFromSource(sourceId: string) {
    const source = store.sources.get(sourceId)
    if (!source?.metadata) return
    updateMetadataUseCase(store, source.metadata)
  }

  function addKeyword(keyword: string) {
    store.addKeyword(keyword)
  }

  function removeKeyword(keyword: string) {
    store.removeKeyword(keyword)
  }

  function setSecurity(next: Partial<SecurityMetadata>) {
    store.setSecurity(next)
  }

  return {
    setProjectTitleDraft,
    commitProjectTitle,
    setCurrentTool,
    setMetadata,
    applyMetadataFromSource,
    addKeyword,
    removeKeyword,
    setSecurity,
  }
}
