<script setup lang="ts">
import { shallowRef, watchEffect, useTemplateRef } from 'vue'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import type { PageEntry } from '@/shared/types'

const props = withDefaults(defineProps<{
  entry: PageEntry
  index: number
  dragLabel: string
  isDivider: boolean
  dragDisabled?: boolean
}>(), {
  dragDisabled: false,
})

const elementRef = useTemplateRef<HTMLElement>('elementRef')
const closestEdge = shallowRef<Edge | null>(null)
const isDragging = shallowRef(false)

watchEffect((onCleanup) => {
  const el = elementRef.value
  if (!el || props.dragDisabled) {
    isDragging.value = false
    closestEdge.value = null
    return
  }

  const cleanup = combine(
    draggable({
      element: el,
      getInitialData: () => ({
        type: 'grid-item',
        index: props.index,
        id: props.entry.id,
        entryType: props.isDivider ? 'divider' : 'page',
      }),
      onDragStart: () => {
        isDragging.value = true
      },
      onDrop: () => {
        isDragging.value = false
      },
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: 20, y: 20 }),
          render: ({ container }) => {
            container.style.width = '120px'
            container.style.height = '160px'
            container.style.backgroundColor = 'var(--card)'
            container.style.border = '2px solid var(--primary)'
            container.style.borderRadius = '8px'
            container.style.opacity = '0.8'
            container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)'
            container.style.transform = 'rotate(3deg)'

            const label = document.createElement('div')
            label.innerText = props.dragLabel
            label.style.position = 'absolute'
            label.style.bottom = '8px'
            label.style.width = '100%'
            label.style.textAlign = 'center'
            label.style.fontSize = '10px'
            label.style.fontFamily = 'var(--font-mono)'
            label.style.color = 'var(--muted-foreground)'
            container.appendChild(label)
          },
        })
      },
    }),
    dropTargetForElements({
      element: el,
      getData: ({ input, element }) => {
        return attachClosestEdge(
          {
            index: props.index,
            id: props.entry.id,
          },
          {
            element,
            input,
            allowedEdges: ['left', 'right'],
          },
        )
      },
      onDragEnter: ({ self }) => {
        closestEdge.value = extractClosestEdge(self.data)
      },
      onDrag: ({ self }) => {
        closestEdge.value = extractClosestEdge(self.data)
      },
      onDragLeave: () => {
        closestEdge.value = null
      },
      onDrop: () => {
        closestEdge.value = null
      },
    }),
  )

  onCleanup(() => cleanup())
})
</script>

<template>
  <div
    ref="elementRef"
    class="relative group h-full transition-all duration-200"
    :class="[
      props.dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      {
        'opacity-20 scale-95 grayscale': isDragging,
        'z-50': isDragging,
      },
    ]"
  >
    <slot />

    <!-- High-Fidelity Drop Indicator -->
    <div
      v-if="closestEdge"
      class="absolute top-0 bottom-0 w-[2px] bg-primary z-[100] pointer-events-none transition-all duration-200"
      :class="{
        'left-[-4px]': closestEdge === 'left',
        'right-[-4px]': closestEdge === 'right',
      }"
    >
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"
      ></div>
      <div
        class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"
      ></div>
    </div>
  </div>
</template>
