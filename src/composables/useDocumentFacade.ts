import { useAppActions } from './useAppActions'
import { useAppState, type AppState } from './useAppState'
import { useDocumentView, type DocumentView } from './useDocumentView'

/**
 * Facade that exposes the only public UI surface for document workflows.
 * Components should consume { state, actions } from here instead of raw stores/services.
 */
export function useDocumentFacade() {
  const uiState = useAppState()
  const document = useDocumentView()
  const actions = useAppActions(uiState)

  const state = Object.assign(uiState, { document }) as FacadeState

  return { state, actions }
}

export type FacadeState = AppState & { document: DocumentView }
export type DocumentFacade = ReturnType<typeof useDocumentFacade>
