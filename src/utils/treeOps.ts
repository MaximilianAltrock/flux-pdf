import type { UiBookmarkNode } from '@/types'

export type DropMode = 'before' | 'after' | 'inside'

export function containsId(node: UiBookmarkNode, id: string): boolean {
  if (node.id === id) return true
  for (const c of node.children ?? []) {
    if (containsId(c, id)) return true
  }
  return false
}

export function extractNode(
  nodes: UiBookmarkNode[],
  id: string,
): { node: UiBookmarkNode | null; rest: UiBookmarkNode[] } {
  const out: UiBookmarkNode[] = []
  for (const n of nodes) {
    if (n.id === id) {
      // skip (removed)
      continue
    }
    const extracted = extractNode(n.children ?? [], id)
    if (extracted.node) {
      out.push({ ...n, children: extracted.rest })
      return { node: extracted.node, rest: out.concat(nodes.slice(out.length + 1)) }
    }
    out.push(n)
  }
  return { node: null, rest: nodes }
}

export function insertRelative(
  nodes: UiBookmarkNode[],
  targetId: string,
  mode: 'before' | 'after',
  nodeToInsert: UiBookmarkNode,
): UiBookmarkNode[] {
  const out: UiBookmarkNode[] = []
  for (const n of nodes) {
    if (n.id === targetId) {
      if (mode === 'before') out.push(nodeToInsert, n)
      else out.push(n, nodeToInsert)
    } else {
      out.push({
        ...n,
        children: insertRelative(n.children ?? [], targetId, mode, nodeToInsert),
      })
    }
  }
  return out
}

export function insertInside(
  nodes: UiBookmarkNode[],
  targetId: string,
  nodeToInsert: UiBookmarkNode,
): UiBookmarkNode[] {
  return nodes.map((n) => {
    if (n.id === targetId) {
      return {
        ...n,
        expanded: true,
        children: [...(n.children ?? []), nodeToInsert],
      }
    }
    return { ...n, children: insertInside(n.children ?? [], targetId, nodeToInsert) }
  })
}

export function moveNode(
  tree: UiBookmarkNode[],
  draggedId: string,
  targetId: string,
  mode: DropMode,
): UiBookmarkNode[] {
  if (draggedId === targetId) return tree

  const { node: dragged, rest } = extractNode(tree, draggedId)
  if (!dragged) return tree

  // prevent cycles: cannot move a node inside its own subtree
  const targetNode = findNode(rest, targetId)
  if (targetNode && containsId(dragged, targetId)) return tree

  if (mode === 'inside') return insertInside(rest, targetId, dragged)
  if (mode === 'before') return insertRelative(rest, targetId, 'before', dragged)
  return insertRelative(rest, targetId, 'after', dragged)
}

export function findNode(nodes: UiBookmarkNode[], id: string): UiBookmarkNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const child = findNode(n.children ?? [], id)
    if (child) return child
  }
  return null
}
