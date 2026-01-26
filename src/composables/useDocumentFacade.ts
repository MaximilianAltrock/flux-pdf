import { useAppActions } from './useAppActions'
import { useAppState, type AppState } from './useAppState'
import { useDocumentView, type DocumentView } from './useDocumentView'
import { usePreflight } from './usePreflight'

/**
 * Facade that exposes the only public UI surface for document workflows.
 * Components should consume { state, actions } from here instead of raw stores/services.
 */
export function useDocumentFacade() {
  const uiState = useAppState()
  const document = useDocumentView()
  const preflight = usePreflight()
  const actions = useAppActions(uiState)

  const state = Object.assign(uiState, { document, preflight }) as FacadeState

  return { state, actions }
}

export type FacadeState = AppState & { document: DocumentView; preflight: ReturnType<typeof usePreflight> }
export type DocumentFacade = ReturnType<typeof useDocumentFacade>
