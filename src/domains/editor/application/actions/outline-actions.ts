import { updateOutlineTree as updateOutlineTreeUseCase } from '@/domains/document/application/use-cases'
import type { HistoryCommandExecutor } from '@/domains/history/application'
import type { useDocumentStore } from '@/domains/document/store/document.store'
import type { useUiStore } from '@/domains/editor/store/ui.store'
import { autoGenOutlineFromPages } from '@/shared/utils/auto-gen-tree'
import {
  removeOutlineNode,
  removeBrokenOutlineTargets,
  setOutlineNodeDest,
  setOutlineNodeExpanded,
  setOutlineNodeStyle,
  setOutlineNodeTitle,
} from '@/shared/utils/outline-tree'
import type { OutlineNode, PageReference } from '@/shared/types'

interface OutlineActionsToast {
  success: (message: string) => void
}

export interface CreateOutlineActionsDeps {
  store: ReturnType<typeof useDocumentStore>
  history: HistoryCommandExecutor
  ui: Pick<ReturnType<typeof useUiStore>, 'beginOutlineTargeting' | 'endOutlineTargeting'> & {
    outlineTargetNodeId: string | null
  }
  toast: OutlineActionsToast
}

export function createOutlineActions({ store, history, ui, toast }: CreateOutlineActionsDeps) {
  function updateOutlineTree(
    nextTree: OutlineNode[],
    options?: { name?: string; nextDirty?: boolean },
  ) {
    updateOutlineTreeUseCase(history, {
      previousTree: store.outlineTree,
      nextTree,
      previousDirty: store.outlineDirty,
      name: options?.name,
      nextDirty: options?.nextDirty,
    })
  }

  function createOutlineNodeForPage(pageId: string, title = 'New Bookmark'): OutlineNode {
    return {
      id: crypto.randomUUID(),
      parentId: null,
      title,
      expanded: true,
      dest: {
        type: 'page',
        targetPageId: pageId,
        fit: 'Fit',
      },
      children: [],
    }
  }

  function findOutlineNodeById(nodes: OutlineNode[], nodeId: string): OutlineNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) return node
      if (node.children?.length) {
        const nested = findOutlineNodeById(node.children, nodeId)
        if (nested) return nested
      }
    }
    return null
  }

  function addOutlineNodeForPage(pageId: string, title?: string) {
    const node = createOutlineNodeForPage(pageId, title ?? 'New Bookmark')
    updateOutlineTree([...store.outlineTree, node], { name: 'Add outline node' })
  }

  function renameOutlineNode(nodeId: string, title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    updateOutlineTree(setOutlineNodeTitle(store.outlineTree, nodeId, trimmed), {
      name: 'Rename outline node',
    })
  }

  function setOutlineNodeTarget(nodeId: string, targetPageId: string): boolean {
    const node = findOutlineNodeById(store.outlineTree, nodeId)
    if (!node) return false
    const isAlreadyTargetingSamePage =
      node.dest.type === 'page' &&
      node.dest.targetPageId === targetPageId &&
      node.dest.fit === 'Fit' &&
      node.dest.zoom === undefined &&
      node.dest.y === undefined &&
      node.dest.url === undefined

    if (isAlreadyTargetingSamePage) {
      return false
    }

    updateOutlineTree(
      setOutlineNodeDest(store.outlineTree, nodeId, {
        type: 'page',
        targetPageId,
        fit: 'Fit',
      }),
      { name: 'Set outline target' },
    )
    return true
  }

  function setOutlineNodeUrl(nodeId: string, url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    updateOutlineTree(
      setOutlineNodeDest(store.outlineTree, nodeId, {
        type: 'external-url',
        url: trimmed,
      }),
      { name: 'Set outline URL' },
    )
  }

  function clearOutlineNodeTarget(nodeId: string) {
    updateOutlineTree(setOutlineNodeDest(store.outlineTree, nodeId, { type: 'none' }), {
      name: 'Clear outline target',
    })
  }

  function updateOutlineNodeStyle(
    nodeId: string,
    style: { color?: string; isBold?: boolean; isItalic?: boolean },
  ) {
    updateOutlineTree(setOutlineNodeStyle(store.outlineTree, nodeId, style), {
      name: 'Update outline style',
    })
  }

  function deleteOutlineNode(nodeId: string) {
    updateOutlineTree(removeOutlineNode(store.outlineTree, nodeId, 'node'), {
      name: 'Remove outline node',
    })
  }

  function deleteOutlineBranch(nodeId: string) {
    updateOutlineTree(removeOutlineNode(store.outlineTree, nodeId, 'branch'), {
      name: 'Remove outline branch',
    })
  }

  function toggleOutlineExpanded(nodeId: string, expanded: boolean) {
    const nextTree = setOutlineNodeExpanded(store.outlineTree, nodeId, expanded)
    store.setOutlineTree(nextTree, false)
  }

  function resetOutlineToFileStructure() {
    const nextTree = autoGenOutlineFromPages(store.contentPages as PageReference[], store.sources)
    updateOutlineTree(nextTree, { name: 'Reset outline', nextDirty: false })
  }

  function cleanBrokenOutlineNodes() {
    const validPageIds = new Set(store.contentPages.map((p) => p.id))
    const nextTree = removeBrokenOutlineTargets(store.outlineTree, validPageIds)
    updateOutlineTree(nextTree, { name: 'Clean broken outline links' })
  }

  function beginOutlineTargeting(nodeId: string) {
    ui.beginOutlineTargeting(nodeId)
  }

  function completeOutlineTargeting(targetPageId: string): boolean {
    const nodeId = ui.outlineTargetNodeId
    if (!nodeId) return false
    ui.endOutlineTargeting()
    const didUpdate = setOutlineNodeTarget(nodeId, targetPageId)
    if (didUpdate) {
      toast.success('Outline target updated')
    }
    return true
  }

  return {
    updateOutlineTree,
    addOutlineNodeForPage,
    renameOutlineNode,
    setOutlineNodeTarget,
    setOutlineNodeUrl,
    clearOutlineNodeTarget,
    updateOutlineNodeStyle,
    deleteOutlineNode,
    deleteOutlineBranch,
    toggleOutlineExpanded,
    resetOutlineToFileStructure,
    cleanBrokenOutlineNodes,
    beginOutlineTargeting,
    completeOutlineTargeting,
  }
}
