import type { Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'

/**
 * Minimal interface for tree nodes. Any type with `id` and optional `children` works.
 */
export interface TreeNode {
  id: string
  children?: TreeNode[]
}

export type TreeAction =
  | {
      type: 'instruction'
      instruction: Instruction
      itemId: string
      targetId: string
    }
  | {
      type: 'toggle'
      itemId: string
    }
  | {
      type: 'expand'
      itemId: string
    }
  | {
      type: 'collapse'
      itemId: string
    }
  | {
      type: 'modal-move'
      itemId: string
      targetId: string
      index: number
    }

export const tree = {
  remove(data: TreeNode[], id: string): TreeNode[] {
    return data
      .filter((item) => item.id !== id)
      .map((item) => {
        if (tree.hasChildren(item)) {
          return {
            ...item,
            children: tree.remove(item.children ?? [], id),
          }
        }
        return item
      })
  },

  insertBefore(data: TreeNode[], targetId: string, newItem: TreeNode): TreeNode[] {
    return data.flatMap((item) => {
      if (item.id === targetId) return [newItem, item]

      if (tree.hasChildren(item)) {
        return {
          ...item,
          children: tree.insertBefore(item.children ?? [], targetId, newItem),
        }
      }
      return item
    })
  },

  insertAfter(data: TreeNode[], targetId: string, newItem: TreeNode): TreeNode[] {
    return data.flatMap((item) => {
      if (item.id === targetId) return [item, newItem]

      if (tree.hasChildren(item)) {
        return {
          ...item,
          children: tree.insertAfter(item.children ?? [], targetId, newItem),
        }
      }

      return item
    })
  },

  insertChild(data: TreeNode[], targetId: string, newItem: TreeNode): TreeNode[] {
    return data.flatMap((item) => {
      if (item.id === targetId) {
        return {
          ...item,
          children: [newItem, ...(item.children ?? [])],
        }
      }

      if (!tree.hasChildren(item)) return item

      return {
        ...item,
        children: tree.insertChild(item.children ?? [], targetId, newItem),
      }
    })
  },

  find(data: TreeNode[], itemId: string): TreeNode | undefined {
    for (const item of data) {
      if (item.id === itemId) return item

      if (tree.hasChildren(item)) {
        const result = tree.find(item.children ?? [], itemId)
        if (result) return result
      }
    }
  },

  getPathToItem({
    current,
    targetId,
    parentIds = [],
  }: {
    current: TreeNode[]
    targetId: string
    parentIds?: string[]
  }): string[] | undefined {
    for (const item of current) {
      if (item.id === targetId) return parentIds

      const nested = tree.getPathToItem({
        current: item.children ?? [],
        targetId,
        parentIds: [...parentIds, item.id],
      })
      if (nested) return nested
    }
  },

  hasChildren(item: TreeNode): boolean {
    return (item.children ?? []).length > 0
  },
}

function getChildItems(data: TreeNode[], targetId: string) {
  if (targetId === '') return data

  const targetItem = tree.find(data, targetId)
  if (!targetItem) {
    console.error(`Missing target item: ${targetId}`)
    return
  }

  return targetItem.children
}

export function updateTree(data: TreeNode[], action: TreeAction): TreeNode[] | undefined {
  const item = tree.find(data, action.itemId)
  if (!item) return data

  if (action.type === 'instruction') {
    const instruction = action.instruction

    if (instruction.type === 'reparent') {
      const path = tree.getPathToItem({
        current: data,
        targetId: action.targetId,
      })
      if (!path) {
        console.error(`Missing path for reparent`)
        return
      }

      const desiredId = path[instruction.desiredLevel]
      if (!desiredId) {
        console.error('Missing desiredId at level', instruction.desiredLevel)
        return data
      }
      let result = tree.remove(data, action.itemId)
      result = tree.insertAfter(result, desiredId, item)
      return result
    }

    // The rest of the actions require dropping on something else
    if (action.itemId === action.targetId) return data

    if (instruction.type === 'reorder-above') {
      let result = tree.remove(data, action.itemId)
      result = tree.insertBefore(result, action.targetId, item)
      return result
    }

    if (instruction.type === 'reorder-below') {
      let result = tree.remove(data, action.itemId)
      result = tree.insertAfter(result, action.targetId, item)
      return result
    }

    if (instruction.type === 'make-child') {
      let result = tree.remove(data, action.itemId)
      result = tree.insertChild(result, action.targetId, item)
      return result
    }

    console.warn('Unhandled instruction type:', instruction)
    return data
  }

  if (action.type === 'modal-move') {
    let result = tree.remove(data, item.id)
    const siblingItems = getChildItems(result, action.targetId) ?? []

    if (siblingItems.length === 0) {
      if (action.targetId === '') {
        result = [item]
      } else {
        result = tree.insertChild(result, action.targetId, item)
      }
    } else if (action.index === siblingItems.length) {
      const relativeTo = siblingItems[siblingItems.length - 1]
      if (relativeTo) {
        result = tree.insertAfter(result, relativeTo.id, item)
      }
    } else {
      const relativeTo = siblingItems[action.index]
      if (relativeTo) {
        result = tree.insertBefore(result, relativeTo.id, item)
      }
    }

    return result
  }

  return data
}
