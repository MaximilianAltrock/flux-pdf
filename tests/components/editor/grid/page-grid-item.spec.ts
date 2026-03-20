import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import PageGridItem from '@/domains/editor/ui/components/grid/PageGridItem.vue'
import { provideDocumentActions } from '@/domains/editor/application/useDocumentActions'
import { provideProjectSession } from '@/domains/project-session/session'
import { mountVueComponent } from '../../../utils/mount-vue-component'
import type { PageReference } from '@/shared/types'

vi.mock('@/domains/editor/ui/components/PdfThumbnail.vue', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      name: 'PdfThumbnailStub',
      emits: ['click', 'preview', 'delete', 'rotate', 'visible'],
      setup(_, { emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-testid': 'pdf-thumbnail',
              onClick: () => emit('click', new MouseEvent('click')),
            },
            'thumbnail',
          )
      },
    }),
  }
})

vi.mock('@/shared/components/ui/context-menu', async () => {
  const { defineComponent, h } = await import('vue')
  const passthrough = defineComponent({
    name: 'ContextMenuPassthrough',
    setup(_, { slots, attrs }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

  const item = defineComponent({
    name: 'ContextMenuItemStub',
    setup(_, { slots, attrs }) {
      return () => h('button', { type: 'button', ...attrs }, slots.default?.())
    },
  })

  return {
    ContextMenu: passthrough,
    ContextMenuContent: passthrough,
    ContextMenuTrigger: passthrough,
    ContextMenuItem: item,
    ContextMenuSeparator: passthrough,
    ContextMenuShortcut: passthrough,
    ContextMenuLabel: passthrough,
  }
})

function createPage(id: string, sourcePageIndex: number): PageReference {
  return {
    id,
    sourceFileId: 'source-1',
    sourcePageIndex,
    rotation: 0,
  }
}

const mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  for (const view of mounted.splice(0)) {
    view.unmount()
  }
})

describe('PageGridItem', () => {
  it('allows razor splits before the last page', () => {
    const pageA = createPage('page-a', 0)
    const pageB = createPage('page-b', 1)
    const handleSplitGroup = vi.fn()

    const Wrapper = defineComponent({
      setup() {
        provideDocumentActions({
          completeOutlineTargeting: vi.fn(() => false),
          handleSplitGroup,
          togglePageSelection: vi.fn(),
          selectRange: vi.fn(),
          clearSelection: vi.fn(),
          selectPage: vi.fn(),
        } as never)

        provideProjectSession({
          document: {
            pages: [pageA, pageB],
            lastSelectedId: null,
            selectedIds: new Set<string>(),
            selectedCount: 0,
            getSourceColor: vi.fn(() => '#000000'),
            setActivePageId: vi.fn(),
          },
          editor: {
            zoom: 220,
          },
          dispose: vi.fn(),
        } as never)

        return () =>
          h(PageGridItem, {
            page: pageB,
            index: 1,
            pageNumber: 2,
            selected: false,
            isStartOfFile: false,
            interactionPolicy: {
              tool: 'razor',
              allowSelection: false,
              allowContextMenu: false,
              allowThumbnailActions: false,
              showHoverEffects: false,
            },
          })
      },
    })

    const view = mountVueComponent(Wrapper)
    mounted.push(view)

    const thumbnail = view.host.querySelector('[data-testid="pdf-thumbnail"]') as
      | HTMLButtonElement
      | null
    thumbnail?.click()

    expect(handleSplitGroup).toHaveBeenCalledWith(1)
  })
})
