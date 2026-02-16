import { updateMetadata as updateMetadataUseCase } from '@/domains/document/application/use-cases'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { PrimaryEditorToolId } from '@/domains/editor/domain/types'
import type { DocumentMetadata, SecurityMetadata } from '@/shared/types'

export interface CreateMetadataActionsDeps {
  store: ReturnType<typeof useDocumentStore>
  ui: Pick<ReturnType<typeof useUiStore>, 'setCurrentTool'>
  normalizeProjectTitle: (value: string) => string
}

export function createMetadataActions({
  store,
  ui,
  normalizeProjectTitle,
}: CreateMetadataActionsDeps) {
  function setProjectTitleDraft(value: string) {
    if (store.isTitleLocked) return
    store.setProjectTitle(value)
  }

  function commitProjectTitle(value?: string) {
    if (store.isTitleLocked) return
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
