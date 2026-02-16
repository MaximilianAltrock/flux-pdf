<script setup lang="ts">
import { computed, h, nextTick, ref, shallowRef, render, watchEffect, useTemplateRef } from 'vue'
import { TreeItem as RekaTreeItem, type FlattenedItem } from 'reka-ui'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  type Instruction,
  type ItemMode,
  attachInstruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import type { ClassValue } from 'clsx'
import { cn } from '@/shared/lib/utils'
import type { TreeNode } from './utils'

interface Props {
  item: FlattenedItem<TreeNode>
  indentPerLevel?: number
  class?: ClassValue
}

const props = withDefaults(defineProps<Props>(), {
  indentPerLevel: 16,
})

// Separate refs: one for the DOM element (drag/drop), one for the component API
const wrapperRef = useTemplateRef<HTMLDivElement>('wrapperRef')
const componentRef = useTemplateRef<{ isExpanded: boolean; handleToggle: () => void }>('componentRef')
const isDragging = shallowRef(false)
const isDraggedOver = shallowRef(false)
const isInitialExpanded = shallowRef(false)
const instruction = ref<Extract<
  Instruction,
  { type: 'reorder-above' | 'reorder-below' | 'make-child' }
> | null>(null)

const mode = computed<ItemMode>(() => {
  if (props.item.hasChildren) return 'expanded'
  if (props.item.index + 1 === props.item.parentItem?.children?.length) return 'last-in-group'
  return 'standard'
})

const itemClass = computed(() => cn('relative w-full border-none', props.class))

watchEffect((onCleanup) => {
  const currentElement = wrapperRef.value
  if (!currentElement) return

  const item = {
    ...props.item.value,
    level: props.item.level,
    id: props.item._id,
  }

  const expandItem = () => {
    if (!componentRef.value?.isExpanded) {
      componentRef.value?.handleToggle()
    }
  }

  const closeItem = () => {
    if (componentRef.value?.isExpanded) {
      componentRef.value?.handleToggle()
    }
  }

  const cleanup = combine(
    draggable({
      element: currentElement,
      getInitialData: () => item,
      onDragStart: () => {
        isDragging.value = true
        isInitialExpanded.value = componentRef.value?.isExpanded ?? false
        closeItem()
      },
      onDrop: () => {
        isDragging.value = false
        if (isInitialExpanded.value) expandItem()
      },
      onGenerateDragPreview({ nativeSetDragImage }) {
        setCustomNativeDragPreview({
          getOffset: pointerOutsideOfPreview({ x: '16px', y: '8px' }),
          render: ({ container }) => {
            return render(
              h(
                'div',
                {
                  class:
                    'bg-card text-primary rounded-md text-sm font-medium px-3 py-1.5 shadow-lg',
                },
                (props.item.value as { title?: string }).title ?? props.item._id,
              ),
              container,
            )
          },
          nativeSetDragImage,
        })
      },
    }),

    dropTargetForElements({
      element: currentElement,
      getData: ({ input, element }) => {
        const data = { id: item.id }

        return attachInstruction(data, {
          input,
          element,
          indentPerLevel: props.indentPerLevel,
          currentLevel: props.item.level,
          mode: mode.value,
          block: [],
        })
      },
      canDrop: ({ source }) => {
        return source.data.id !== item.id
      },
      onDrag: ({ self }) => {
        instruction.value = extractInstruction(self.data) as typeof instruction.value
      },
      onDragEnter: ({ source }) => {
        if (source.data.id !== item.id) {
          isDraggedOver.value = true
          expandItem()
        }
      },
      onDragLeave: () => {
        isDraggedOver.value = false
        instruction.value = null
      },
      onDrop: ({ location }) => {
        isDraggedOver.value = false
        instruction.value = null
        const firstTarget = location.current.dropTargets[0]
        if (firstTarget?.data.id === item.id) {
          nextTick(() => {
            expandItem()
          })
        }
      },
      getIsSticky: () => true,
    }),

    monitorForElements({
      canMonitor: ({ source }) => {
        return source.data.id !== item.id
      },
    }),
  )

  onCleanup(() => cleanup())
})

defineSlots<{
  default(props: { isExpanded: boolean; isDragging: boolean; isDraggedOver: boolean }): unknown
}>()
</script>

<template>
  <div ref="wrapperRef" :class="itemClass" :style="{ opacity: isDragging ? 0.5 : 1 }">
    <RekaTreeItem
      ref="componentRef"
      v-slot="{ isExpanded }"
      :value="item.value"
      :level="item.level"
      class="h-full w-full flex items-center"
    >
      <slot :is-expanded="isExpanded" :is-dragging="isDragging" :is-dragged-over="isDraggedOver" />

      <!-- Drop Indicator -->
      <div
        v-if="instruction"
        class="absolute h-full w-full top-0 border-primary pointer-events-none"
        :style="{
          left: `${instruction.currentLevel * instruction.indentPerLevel}px`,
          width: `calc(100% - ${instruction.currentLevel * instruction.indentPerLevel}px)`,
        }"
        :class="{
          'border-b-2': instruction.type === 'reorder-below',
          'border-t-2': instruction.type === 'reorder-above',
          'border-2 rounded': instruction.type === 'make-child',
        }"
      />
    </RekaTreeItem>
  </div>
</template>
