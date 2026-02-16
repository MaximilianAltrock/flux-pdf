import { describe, expect, it, vi } from 'vitest'
import { createMetadataActions } from '@/domains/editor/application/actions/metadata-actions'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { SourceFile } from '@/shared/types'

function createHarness(overrides?: { isTitleLocked?: boolean }) {
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
    isTitleLocked: overrides?.isTitleLocked ?? false,
    projectTitle: 'Current',
    sources: new Map([[source.id, source]]),
    setProjectTitle: vi.fn(),
    setMetadata: vi.fn(),
    addKeyword: vi.fn(),
    removeKeyword: vi.fn(),
    setSecurity: vi.fn(),
  } as unknown as ReturnType<typeof useDocumentStore>
  const ui = {
    setCurrentTool: vi.fn(),
  } as unknown as Pick<ReturnType<typeof useUiStore>, 'setCurrentTool'>
  const normalizeProjectTitle = vi.fn((value: string) => `normalized:${value}`)

  const actions = createMetadataActions({
    store,
    ui,
    normalizeProjectTitle,
  })

  return { actions, store, ui, normalizeProjectTitle, source }
}

describe('metadata action module', () => {
  it('does not update title draft when title is locked', () => {
    const harness = createHarness({ isTitleLocked: true })

    harness.actions.setProjectTitleDraft('New Title')

    expect(harness.store.setProjectTitle).not.toHaveBeenCalled()
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
