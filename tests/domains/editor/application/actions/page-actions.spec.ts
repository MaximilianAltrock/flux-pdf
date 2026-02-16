import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createPageActions } from '@/domains/editor/application/actions/page-actions'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useHistoryStore } from '@/domains/history/store/history.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { PageReference } from '@/shared/types'
import type { PreflightFix } from '@/shared/types/linter'

function createHarness(overrides?: {
  selectedCount?: number
  selectedIds?: string[]
  pages?: PageReference[]
  contentPages?: PageReference[]
}) {
  const pageA: PageReference = {
    id: 'page-a',
    sourceFileId: 'source-1',
    sourcePageIndex: 0,
    rotation: 0,
  }
  const pageB: PageReference = {
    id: 'page-b',
    sourceFileId: 'source-1',
    sourcePageIndex: 1,
    rotation: 0,
  }
  const pageC: PageReference = {
    id: 'page-c',
    sourceFileId: 'source-1',
    sourcePageIndex: 2,
    rotation: 0,
  }

  const pages = overrides?.pages ?? [pageA, pageB, pageC]
  const selectedIds = new Set(overrides?.selectedIds ?? ['page-a'])

  const store = {
    selectedCount: overrides?.selectedCount ?? selectedIds.size,
    selection: { selectedIds },
    pages,
    contentPages: overrides?.contentPages ?? pages,
    sources: new Map(),
    selectPage: vi.fn(),
    clearSelection: vi.fn(),
    togglePageSelection: vi.fn(),
    selectRange: vi.fn(),
    selectAll: vi.fn(),
  } as unknown as ReturnType<typeof useDocumentStore>

  const history = {
    execute: vi.fn(),
    undo: vi.fn(),
  } as unknown as ReturnType<typeof useHistoryStore>

  const ui = {
    previewPageRef: null,
    openPreviewModal: vi.fn(),
    closePreviewModal: vi.fn(),
    openDiffModal: vi.fn(),
    setInspectorTab: vi.fn(),
    exitMobileSelectionMode: vi.fn(),
    enterMobileSelectionMode: vi.fn(),
    enterMobileMoveMode: vi.fn(),
    exitMobileMoveMode: vi.fn(),
    setCurrentTool: vi.fn(),
  } as unknown as ReturnType<typeof useUiStore>

  const toast = {
    success: vi.fn(),
    warning: vi.fn(),
  }
  const confirmDelete = vi.fn(async () => true)
  const haptic = vi.fn()

  const actions = createPageActions({
    store,
    history,
    ui,
    toast,
    isMobile: ref(false),
    haptic,
    confirmDelete,
  })

  return { actions, store, history, ui, toast, haptic }
}

describe('page action module', () => {
  it('warns when diff action does not have exactly two selected pages', () => {
    const harness = createHarness({ selectedCount: 1, selectedIds: ['page-a'] })

    harness.actions.handleDiffSelected()

    expect(harness.toast.warning).toHaveBeenCalledOnce()
    expect(harness.ui.openDiffModal).not.toHaveBeenCalled()
  })

  it('routes preflight metadata fixes to metadata inspector', () => {
    const harness = createHarness()
    const fix = { id: 'edit-metadata' } as PreflightFix

    harness.actions.applyPreflightFix(fix, [])

    expect(harness.ui.setInspectorTab).toHaveBeenCalledWith('metadata')
  })

  it('reorders selected pages in mobile move flow', () => {
    const harness = createHarness({ selectedCount: 1, selectedIds: ['page-b'] })

    harness.actions.handleMoveSelectedToPosition(3)

    expect(harness.history.execute).toHaveBeenCalledOnce()
    expect(harness.ui.exitMobileMoveMode).toHaveBeenCalled()
  })
})
