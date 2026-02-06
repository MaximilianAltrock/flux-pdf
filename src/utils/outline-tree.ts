import type { OutlineNode } from '@/types'

export function updateOutlineNode(
  nodes: OutlineNode[],
  nodeId: string,
  updater: (node: OutlineNode) => OutlineNode,
): OutlineNode[] {
  return (nodes ?? []).map((node) => {
    if (node.id === nodeId) {
      return updater({ ...node, children: node.children ?? [] })
    }
    if (!node.children?.length) return node
    return {
      ...node,
      children: updateOutlineNode(node.children, nodeId, updater),
    }
  })
}

export function removeOutlineNode(
  nodes: OutlineNode[],
  nodeId: string,
  mode: 'node' | 'branch',
): OutlineNode[] {
  const result: OutlineNode[] = []
  for (const node of nodes ?? []) {
    if (node.id === nodeId) {
      if (mode === 'branch') continue
      result.push(...(node.children ?? []))
      continue
    }

    if (!node.children?.length) {
      result.push(node)
      continue
    }

    result.push({
      ...node,
      children: removeOutlineNode(node.children, nodeId, mode),
    })
  }
  return result
}

export function setOutlineNodeTitle(
  nodes: OutlineNode[],
  nodeId: string,
  title: string,
): OutlineNode[] {
  return updateOutlineNode(nodes, nodeId, (node) => ({ ...node, title }))
}

export function setOutlineNodeExpanded(
  nodes: OutlineNode[],
  nodeId: string,
  expanded: boolean,
): OutlineNode[] {
  return updateOutlineNode(nodes, nodeId, (node) => ({ ...node, expanded }))
}

export function setOutlineNodeStyle(
  nodes: OutlineNode[],
  nodeId: string,
  style: { color?: string; isBold?: boolean; isItalic?: boolean },
): OutlineNode[] {
  return updateOutlineNode(nodes, nodeId, (node) => ({ ...node, ...style }))
}

export function setOutlineNodeDest(
  nodes: OutlineNode[],
  nodeId: string,
  dest: OutlineNode['dest'],
): OutlineNode[] {
  return updateOutlineNode(nodes, nodeId, (node) => ({ ...node, dest: { ...dest } }))
}

export function removeBrokenOutlineTargets(
  nodes: OutlineNode[],
  validPageIds: Set<string>,
): OutlineNode[] {
  const result: OutlineNode[] = []
  for (const node of nodes ?? []) {
    const children = removeBrokenOutlineTargets(node.children ?? [], validPageIds)
    const isBroken =
      node.dest.type === 'page' &&
      (!node.dest.targetPageId || !validPageIds.has(node.dest.targetPageId))

    if (isBroken) {
      result.push(...children)
      continue
    }

    result.push({ ...node, children })
  }
  return result
}
