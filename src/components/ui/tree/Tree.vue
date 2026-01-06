<script setup lang="ts">
import { TreeRoot, type FlattenedItem } from 'reka-ui'
import { shallowRef, watchEffect, computed } from 'vue'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  type Instruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'
import { cn } from '@/lib/utils'
import { updateTree, type TreeNode } from './utils'

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

        const targetId = target.data.id as string
        const instruction: Instruction | null = extractInstruction(target.data)

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
    :multiple="multiple"
    :propagate-select="propagateSelect"
  >
    <slot :flatten-items="flattenItems" />
  </TreeRoot>
</template>
