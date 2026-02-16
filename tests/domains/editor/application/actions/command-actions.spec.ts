import { describe, expect, it, vi } from 'vitest'
import { createCommandActions } from '@/domains/editor/application/actions/command-actions'
import { UserAction } from '@/shared/types/actions'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { PageReference } from '@/shared/types'

function createHarness() {
  const selectedIds = new Set<string>()
  const store = {
    selection: { selectedIds },
    contentPages: [] as PageReference[],
    selectedCount: 0,
    selectPage: vi.fn(),
    selectAll: vi.fn(),
  } as unknown as Pick<
    ReturnType<typeof useDocumentStore>,
    'selection' | 'contentPages' | 'selectedCount' | 'selectPage' | 'selectAll'
  >
  const ui = {
    closeCommandPalette: vi.fn(),
  } as unknown as Pick<ReturnType<typeof useUiStore>, 'closeCommandPalette'>

  const handlers = {
    openFileDialog: vi.fn(),
    handlePagePreview: vi.fn(),
    handleDuplicateSelected: vi.fn(),
    handleRotateSelected: vi.fn(),
    handleExportSelected: vi.fn(),
    handleDeleteSelected: vi.fn(),
    handleDiffSelected: vi.fn(),
    handleExport: vi.fn(),
    handleNewProject: vi.fn(),
  }

  const actions = createCommandActions({
    store,
    ui,
    ...handlers,
  })

  return { actions, store, ui, handlers }
}

describe('command action module', () => {
  it('selects page first when context action targets an unselected page', () => {
    const harness = createHarness()
    const page: PageReference = {
      id: 'page-1',
      sourceFileId: 'source-1',
      sourcePageIndex: 0,
      rotation: 0,
    }

    harness.actions.handleContextAction(UserAction.PREVIEW, page)

    expect(harness.store.selectPage).toHaveBeenCalledWith('page-1', false)
    expect(harness.handlers.handlePagePreview).toHaveBeenCalledWith(page)
  })

  it('closes palette and opens file dialog for add-files command', () => {
    const harness = createHarness()

    harness.actions.handleCommandAction(UserAction.ADD_FILES)

    expect(harness.ui.closeCommandPalette).toHaveBeenCalledOnce()
    expect(harness.handlers.openFileDialog).toHaveBeenCalledOnce()
  })

  it('opens preview from command action when exactly one page is selected', () => {
    const harness = createHarness()
    const page: PageReference = {
      id: 'page-1',
      sourceFileId: 'source-1',
      sourcePageIndex: 0,
      rotation: 0,
    }
    harness.store.selection.selectedIds.add(page.id)
    harness.store.selectedCount = 1
    harness.store.contentPages.push(page)

    harness.actions.handleCommandAction(UserAction.PREVIEW)

    expect(harness.handlers.handlePagePreview).toHaveBeenCalledWith(page)
  })
})
