import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSourcePageSelection } from '@/domains/document/application/composables/useSourcePageSelection'

function clickEvent(modifiers: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}) {
  return {
    shiftKey: Boolean(modifiers.shiftKey),
    ctrlKey: Boolean(modifiers.ctrlKey),
    metaKey: Boolean(modifiers.metaKey),
  } as MouseEvent
}

function dragEventWithDataTransfer() {
  const dataTransfer = {
    effectAllowed: 'none',
    setData: vi.fn(),
  } as unknown as DataTransfer

  return {
    dataTransfer,
  } as DragEvent
}

describe('useSourcePageSelection', () => {
  it('selects single pages, toggles with modifier, and selects ranges with shift', () => {
    const sourceId = ref('source-1')
    const selection = useSourcePageSelection(sourceId)

    selection.handlePageClick(clickEvent(), 2)
    expect(Array.from(selection.selectedPages.value)).toEqual([2])

    selection.handlePageClick(clickEvent({ ctrlKey: true }), 4)
    expect(Array.from(selection.selectedPages.value).sort((a, b) => a - b)).toEqual([2, 4])

    selection.handlePageClick(clickEvent({ shiftKey: true }), 6)
    expect(Array.from(selection.selectedPages.value).sort((a, b) => a - b)).toEqual([4, 5, 6])

    selection.clearSelection()
    expect(selection.selectedPages.value.size).toBe(0)
  })

  it('writes source-page payload when one page is selected', () => {
    const selection = useSourcePageSelection('source-1')
    const event = dragEventWithDataTransfer()

    selection.handlePageDragStart(event, 3)

    expect(event.dataTransfer.effectAllowed).toBe('copy')
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-flux-source-page',
      'source-1:3',
    )
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      'application/json',
      JSON.stringify({ type: 'source-page', sourceId: 'source-1', pageIndex: 3 }),
    )
  })

  it('writes source-pages payload when multiple pages are selected', () => {
    const selection = useSourcePageSelection('source-1')
    const event = dragEventWithDataTransfer()

    selection.handlePageClick(clickEvent(), 1)
    selection.handlePageClick(clickEvent({ ctrlKey: true }), 3)
    selection.handlePageClick(clickEvent({ ctrlKey: true }), 2)
    selection.handlePageDragStart(event, 2)

    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-flux-source-pages',
      JSON.stringify({ type: 'source-pages', sourceId: 'source-1', pages: [1, 2, 3] }),
    )
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      'application/json',
      JSON.stringify({ type: 'source-pages', sourceId: 'source-1', pages: [1, 2, 3] }),
    )
  })
})
