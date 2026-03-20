import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserAction } from '@/shared/types/actions'
import { useKeyboardShortcuts } from '@/domains/editor/application/useKeyboardShortcuts'
import type { DocumentActions } from '@/domains/editor/application/useDocumentActions'
import type { ProjectSession } from '@/domains/project-session/domain/project-session'

const listenerState = vi.hoisted(() => ({
  keydown: null as ((event: KeyboardEvent) => void) | null,
}))

const shortcutState = vi.hoisted(() => ({
  isMobile: false,
  hasSelection: false,
}))

vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn((event: string, handler: (value: KeyboardEvent) => void) => {
    if (event === 'keydown') {
      listenerState.keydown = handler
    }
  }),
}))

vi.mock('@/shared/composables/useMobile', () => ({
  useMobile: () => ({
    isMobile: ref(shortcutState.isMobile),
  }),
}))

vi.mock('@/domains/editor/application/useEditorActionAvailability', () => ({
  useEditorActionAvailability: () => ({
    hasSelection: ref(shortcutState.hasSelection),
  }),
}))

function createHarness() {
  const actions = {
    setCurrentTool: vi.fn(),
    selectAllPages: vi.fn(),
    clearSelection: vi.fn(),
    handleCommandAction: vi.fn(),
    selectPage: vi.fn(),
    clearSelectionKeepMode: vi.fn(),
    selectRange: vi.fn(),
  } as unknown as DocumentActions

  const session = {
    document: {
      selectedCount: 0,
      selection: {
        selectedIds: new Set<string>(),
        lastSelectedId: null as string | null,
      },
      contentPages: [],
    },
    history: {
      undo: vi.fn(),
      redo: vi.fn(),
    },
    editor: {
      openCommandPalette: vi.fn(),
      zoom: 120,
    },
  } as unknown as ProjectSession

  const isModalOpen = ref(false)

  useKeyboardShortcuts(actions, { isModalOpen }, session)

  if (!listenerState.keydown) {
    throw new Error('keydown listener was not registered')
  }

  return {
    actions,
    session,
    isModalOpen,
    keydown: listenerState.keydown,
  }
}

function createKeydownEvent(
  init: ConstructorParameters<typeof KeyboardEvent>[1],
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', init)
  Object.defineProperty(event, 'target', {
    configurable: true,
    value: document.createElement('div'),
  })
  return event
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    listenerState.keydown = null
    shortcutState.isMobile = false
    shortcutState.hasSelection = false
  })

  it('opens the command palette on cmd/ctrl+k when no modal is open', () => {
    const harness = createHarness()

    harness.keydown(createKeydownEvent({ key: 'k', metaKey: true }))

    expect(harness.session.editor.openCommandPalette).toHaveBeenCalledOnce()
  })

  it('routes undo and redo shortcuts to history', () => {
    const harness = createHarness()

    harness.keydown(createKeydownEvent({ key: 'z', ctrlKey: true }))
    harness.keydown(createKeydownEvent({ key: 'z', ctrlKey: true, shiftKey: true }))

    expect(harness.session.history.undo).toHaveBeenCalledOnce()
    expect(harness.session.history.redo).toHaveBeenCalledOnce()
  })

  it('dispatches delete through command actions when a selection exists', () => {
    shortcutState.hasSelection = true
    const harness = createHarness()
    harness.session.document.selectedCount = 1
    harness.session.document.selection.selectedIds.add('page-1')

    harness.keydown(createKeydownEvent({ key: 'Delete' }))

    expect(harness.actions.handleCommandAction).toHaveBeenCalledWith(UserAction.DELETE)
  })
})
