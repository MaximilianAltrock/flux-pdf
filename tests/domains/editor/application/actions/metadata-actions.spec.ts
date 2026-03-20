import { describe, expect, it, vi } from 'vitest'
import { createMetadataActions } from '@/domains/editor/application/actions/metadata-actions'
import type { DocumentState } from '@/domains/project-session/session/document-state'
import type { EditorUiState } from '@/domains/project-session/session/editor-ui.state'
import type { SourceFile } from '@/shared/types'

function createHarness() {
  const source: SourceFile = {
    id: 'source-1',
    filename: 'source.pdf',
    pageCount: 1,
    fileSize: 10,
    addedAt: Date.now(),
    color: 'zinc',
    pageMetaData: [],
    metadata: {
      title: 'From Source',
      author: 'Author',
      subject: '',
      keywords: [],
      pdfVersion: '1.7',
    },
  }
  const store = {
    projectTitle: 'Current',
    sources: new Map([[source.id, source]]),
    setProjectTitle: vi.fn(),
    setMetadata: vi.fn(),
    addKeyword: vi.fn(),
    removeKeyword: vi.fn(),
    setSecurity: vi.fn(),
  } as unknown as DocumentState
  const ui = {
    setCurrentTool: vi.fn(),
  } as unknown as Pick<EditorUiState, 'setCurrentTool'>
  const normalizeProjectTitle = vi.fn((value: string) => `normalized:${value}`)

  const actions = createMetadataActions({
    store,
    ui,
    normalizeProjectTitle,
  })

  return { actions, store, ui, normalizeProjectTitle, source }
}

describe('metadata action module', () => {
  it('updates the project title draft directly', () => {
    const harness = createHarness()

    harness.actions.setProjectTitleDraft('New Title')

    expect(harness.store.setProjectTitle).toHaveBeenCalledWith('New Title')
  })

  it('normalizes committed project title when unlocked', () => {
    const harness = createHarness()

    harness.actions.commitProjectTitle('Raw / Title')

    expect(harness.normalizeProjectTitle).toHaveBeenCalledWith('Raw / Title')
    expect(harness.store.setProjectTitle).toHaveBeenCalledWith('normalized:Raw / Title')
  })

  it('applies source metadata through metadata use-case contract', () => {
    const harness = createHarness()

    harness.actions.applyMetadataFromSource(harness.source.id)

    expect(harness.store.setMetadata).toHaveBeenCalledWith(harness.source.metadata, true)
  })

  it('delegates current tool changes and security updates', () => {
    const harness = createHarness()

    harness.actions.setCurrentTool('redact')
    harness.actions.setSecurity({ allowPrinting: false })

    expect(harness.ui.setCurrentTool).toHaveBeenCalledWith('redact')
    expect(harness.store.setSecurity).toHaveBeenCalledWith({ allowPrinting: false })
  })
})
