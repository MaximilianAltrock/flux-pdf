<script setup lang="ts">
import { TreeRoot, type FlattenedItem } from 'reka-ui'
import { shallowRef, watchEffect, computed } from 'vue'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  type Instruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'
import { cn } from '@/shared/lib/utils'
import { TREE_DROP_TARGET_KIND, updateTree, type TreeNode } from './utils'

interface Props {
  items: TreeNode[]
  getKey?: (item: TreeNode) => string
  multiple?: boolean
  propagateSelect?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  getKey: (item: TreeNode) => item.id,
  multiple: false,
  propagateSelect: false,
})

const emit = defineEmits<{
  (e: 'update:items', value: TreeNode[]): void
  (e: 'drop:page', value: { targetId: string; pageId: string }): void
}>()

// Internal reactive copy for DnD updates
const internalItems = shallowRef<TreeNode[]>(props.items)

// Sync external items to internal
watchEffect(() => {
  internalItems.value = props.items
})

// Monitor drag and drop globally
watchEffect((onCleanup) => {
  const cleanup = combine(
    monitorForElements({
      onDrop(args) {
        const { location, source } = args

        if (!location.current.dropTargets.length) return

        const itemId = source.data.id as string
        const target = location.current.dropTargets[0]
        if (!target) return
        if (target.data.dropTargetKind !== TREE_DROP_TARGET_KIND) return

        const targetId = target.data.id as string
        const instruction: Instruction | null = extractInstruction(target.data)

        if (
          source.data.type === 'grid-item' &&
          source.data.entryType === 'page' &&
          typeof itemId === 'string' &&
          typeof targetId === 'string'
        ) {
          emit('drop:page', { targetId, pageId: itemId })
          return
        }

        if (instruction !== null) {
          const newItems = updateTree(internalItems.value, {
            type: 'instruction',
            instruction,
            itemId,
            targetId,
          })

          if (newItems) {
            internalItems.value = newItems
            emit('update:items', newItems)
          }
        }
      },
    }),
  )

  onCleanup(() => cleanup())
})

// Computed class
const rootClass = computed(() =>
  cn('list-none select-none text-sm font-medium', props.class),
)

const expandedKeys = computed(() => collectExpandedKeys(internalItems.value, props.getKey))

function handleExpandedUpdate(nextExpanded: string[]) {
  const expandedSet = new Set(nextExpanded)
  const nextItems = applyExpandedState(internalItems.value, props.getKey, expandedSet)
  internalItems.value = nextItems
  emit('update:items', nextItems)
}

function collectExpandedKeys(items: TreeNode[], getKey: (item: TreeNode) => string): string[] {
  const keys: string[] = []
  for (const item of items ?? []) {
    const isExpanded = (item as { expanded?: boolean }).expanded !== false
    if (isExpanded && (item.children ?? []).length > 0) {
      keys.push(getKey(item))
    }
    if (item.children?.length) {
      keys.push(...collectExpandedKeys(item.children, getKey))
    }
  }
  return keys
}

function applyExpandedState(
  items: TreeNode[],
  getKey: (item: TreeNode) => string,
  expanded: Set<string>,
): TreeNode[] {
  return (items ?? []).map((item) => {
    const key = getKey(item)
    const next = {
      ...item,
      expanded: expanded.has(key),
    }
    if (item.children?.length) {
      return {
        ...next,
        children: applyExpandedState(item.children, getKey, expanded),
      }
    }
    return next
  })
}

// Expose for slot
defineSlots<{
  default(props: { flattenItems: FlattenedItem<TreeNode>[] }): unknown
}>()
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    :class="rootClass"
    :items="internalItems"
    :get-key="getKey"
    :expanded="expandedKeys"
    :multiple="multiple"
    :propagate-select="propagateSelect"
    @update:expanded="handleExpandedUpdate"
  >
    <slot :flatten-items="flattenItems" />
  </TreeRoot>
</template>
