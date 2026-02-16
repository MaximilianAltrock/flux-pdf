import { afterEach, describe, expect, it, vi } from 'vitest'
import Tree from '@/shared/components/ui/tree/Tree.vue'
import { TREE_DROP_TARGET_KIND } from '@/shared/components/ui/tree/utils'
import { mountVueComponent } from '../../../../utils/mount-vue-component'

type DropArgs = {
  source: { data: Record<string, unknown> }
  location: {
    current: {
      dropTargets: Array<{ data: Record<string, unknown> }>
    }
  }
}

const monitorState = vi.hoisted(() => {
  let onDrop: ((args: DropArgs) => void) | null = null
  return {
    setOnDrop(handler: ((args: DropArgs) => void) | undefined) {
      onDrop = handler ?? null
    },
    emitDrop(args: DropArgs) {
      onDrop?.(args)
    },
    reset() {
      onDrop = null
    },
  }
})

vi.mock('@atlaskit/pragmatic-drag-and-drop/combine', () => ({
  combine: (...cleanups: Array<(() => void) | undefined>) => () => {
    for (const cleanup of cleanups) {
      cleanup?.()
    }
  },
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  monitorForElements(args: { onDrop?: (args: DropArgs) => void }) {
    monitorState.setOnDrop(args.onDrop)
    return () => monitorState.reset()
  },
}))

vi.mock('reka-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    TreeRoot: defineComponent({
      name: 'TreeRootStub',
      props: {
        class: { type: [String, Array, Object], default: '' },
        items: { type: Array, default: () => [] },
        getKey: { type: Function, default: undefined },
        expanded: { type: Array, default: () => [] },
        multiple: { type: Boolean, default: false },
        propagateSelect: { type: Boolean, default: false },
      },
      emits: {
        'update:expanded': () => true,
      },
      setup(_props, { slots }) {
        return () => slots.default?.({ flattenItems: [] }) ?? null
      },
    }),
  }
})

const mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  for (const view of mounted.splice(0)) {
    view.unmount()
  }
  monitorState.reset()
})

function emitDrop(sourceData: Record<string, unknown>, targetData: Record<string, unknown>) {
  monitorState.emitDrop({
    source: { data: sourceData },
    location: {
      current: {
        dropTargets: [{ data: targetData }],
      },
    },
  })
}

describe('Tree drop page filtering', () => {
  it('emits drop:page only when dropped on a tree target', () => {
    const onDropPage = vi.fn()
    const view = mountVueComponent(Tree, {
      items: [],
      'onDrop:page': onDropPage,
    })
    mounted.push(view)

    emitDrop(
      { type: 'grid-item', entryType: 'page', id: 'page-1' },
      { id: 'outline-node-1', dropTargetKind: TREE_DROP_TARGET_KIND },
    )

    expect(onDropPage).toHaveBeenCalledWith({
      targetId: 'outline-node-1',
      pageId: 'page-1',
    })
  })

  it('ignores page drops on non-tree targets', () => {
    const onDropPage = vi.fn()
    const view = mountVueComponent(Tree, {
      items: [],
      'onDrop:page': onDropPage,
    })
    mounted.push(view)

    emitDrop(
      { type: 'grid-item', entryType: 'page', id: 'page-1' },
      { id: 'page-2', index: 1 },
    )

    expect(onDropPage).not.toHaveBeenCalled()
  })
})
