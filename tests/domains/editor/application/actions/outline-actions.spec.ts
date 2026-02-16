import { describe, expect, it, vi } from 'vitest'
import { createOutlineActions } from '@/domains/editor/application/actions/outline-actions'
import type { HistoryCommandExecutor } from '@/domains/history/application'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import type { OutlineNode, PageReference, SourceFile } from '@/shared/types'

function createOutlineNode(targetPageId = 'page-1'): OutlineNode {
  return {
    id: 'node-1',
    parentId: null,
    title: 'Node 1',
    expanded: true,
    dest: {
      type: 'page',
      targetPageId,
      fit: 'Fit',
    },
    children: [],
  }
}

function createHarness(outlineTree: OutlineNode[]) {
  const history: HistoryCommandExecutor = { execute: vi.fn() }
  const contentPage: PageReference = {
    id: 'page-1',
    sourceFileId: 'source-1',
    sourcePageIndex: 0,
    rotation: 0,
  }
  const sources = new Map<string, SourceFile>()
  const store = {
    outlineTree,
    outlineDirty: false,
    contentPages: [contentPage],
    sources,
    setOutlineTree: vi.fn(),
  } as unknown as ReturnType<typeof useDocumentStore>
  const ui = {
    outlineTargetNodeId: null as string | null,
    beginOutlineTargeting: vi.fn((nodeId: string) => {
      ui.outlineTargetNodeId = nodeId
    }),
    endOutlineTargeting: vi.fn(() => {
      ui.outlineTargetNodeId = null
    }),
  } as unknown as Pick<ReturnType<typeof useUiStore>, 'beginOutlineTargeting' | 'endOutlineTargeting'> & {
    outlineTargetNodeId: string | null
  }
  const toast = { success: vi.fn<(message: string) => void>() }

  const actions = createOutlineActions({ store, history, ui, toast })

  return { actions, history, ui, toast }
}

describe('outline action module', () => {
  it('does not execute a command when setting the same outline target', () => {
    const harness = createHarness([createOutlineNode('page-1')])

    const didUpdate = harness.actions.setOutlineNodeTarget('node-1', 'page-1')

    expect(didUpdate).toBe(false)
    expect(harness.history.execute).not.toHaveBeenCalled()
  })

  it('completes targeting and emits toast when target changes', () => {
    const harness = createHarness([createOutlineNode('page-1')])
    harness.ui.outlineTargetNodeId = 'node-1'

    const result = harness.actions.completeOutlineTargeting('page-2')

    expect(result).toBe(true)
    expect(harness.ui.endOutlineTargeting).toHaveBeenCalledOnce()
    expect(harness.history.execute).toHaveBeenCalledOnce()
    expect(harness.toast.success).toHaveBeenCalledWith('Outline target updated')
  })

  it('completes targeting without toast when target is unchanged', () => {
    const harness = createHarness([createOutlineNode('page-1')])
    harness.ui.outlineTargetNodeId = 'node-1'

    const result = harness.actions.completeOutlineTargeting('page-1')

    expect(result).toBe(true)
    expect(harness.ui.endOutlineTargeting).toHaveBeenCalledOnce()
    expect(harness.history.execute).not.toHaveBeenCalled()
    expect(harness.toast.success).not.toHaveBeenCalled()
  })

  it('returns false when no outline node is being targeted', () => {
    const harness = createHarness([createOutlineNode('page-1')])

    const result = harness.actions.completeOutlineTargeting('page-2')

    expect(result).toBe(false)
    expect(harness.ui.endOutlineTargeting).not.toHaveBeenCalled()
    expect(harness.history.execute).not.toHaveBeenCalled()
    expect(harness.toast.success).not.toHaveBeenCalled()
  })
})
