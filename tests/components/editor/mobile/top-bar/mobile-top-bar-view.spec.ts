import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileTopBarView from '@/domains/editor/ui/components/mobile/top-bar/MobileTopBarView.vue'
import { mountVueComponent } from '../../../../utils/mount-vue-component'

function createBaseProps() {
  return {
    isSplit: false,
    isMove: false,
    isSelect: false,
    isBrowse: true,
    selectedCount: 2,
    displayTitle: 'Project Alpha',
    hasPages: true,
    isAllSelected: false,
    canUndo: true,
    canRedo: true,
  }
}

const mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  for (const view of mounted.splice(0)) {
    view.unmount()
  }
})

describe('MobileTopBarView', () => {
  it('emits browse mode actions from menu, title, select, undo, and redo controls', () => {
    const handlers = {
      onMenu: vi.fn(),
      onEditTitle: vi.fn(),
      onEnterSelect: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
    }

    const view = mountVueComponent(MobileTopBarView, {
      ...createBaseProps(),
      ...handlers,
    })
    mounted.push(view)

    const menuButton = view.host.querySelector('button[aria-label="Open menu"]') as
      | HTMLButtonElement
      | null
    const titleButton = Array.from(view.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Project Alpha'),
    ) as HTMLButtonElement | undefined
    const selectButton = Array.from(view.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Select'),
    ) as HTMLButtonElement | undefined
    const undoButton = view.host.querySelector('button[aria-label="Undo"]') as
      | HTMLButtonElement
      | null
    const redoButton = view.host.querySelector('button[aria-label="Redo"]') as
      | HTMLButtonElement
      | null

    menuButton?.click()
    titleButton?.click()
    selectButton?.click()
    undoButton?.click()
    redoButton?.click()

    expect(handlers.onMenu).toHaveBeenCalledTimes(1)
    expect(handlers.onEditTitle).toHaveBeenCalledTimes(1)
    expect(handlers.onEnterSelect).toHaveBeenCalledTimes(1)
    expect(handlers.onUndo).toHaveBeenCalledTimes(1)
    expect(handlers.onRedo).toHaveBeenCalledTimes(1)
  })

  it('emits select mode actions for cancel and select-all toggle', () => {
    const cancelHandler = vi.fn()
    const selectAllHandler = vi.fn()
    const deselectAllHandler = vi.fn()

    const selectView = mountVueComponent(MobileTopBarView, {
      ...createBaseProps(),
      isBrowse: false,
      isSelect: true,
      isAllSelected: false,
      onExitSelect: cancelHandler,
      onSelectAll: selectAllHandler,
    })
    mounted.push(selectView)

    const cancelButton = Array.from(selectView.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cancel'),
    ) as HTMLButtonElement | undefined
    const selectAllButton = Array.from(selectView.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Select All'),
    ) as HTMLButtonElement | undefined

    cancelButton?.click()
    selectAllButton?.click()

    expect(cancelHandler).toHaveBeenCalledTimes(1)
    expect(selectAllHandler).toHaveBeenCalledTimes(1)

    const deselectView = mountVueComponent(MobileTopBarView, {
      ...createBaseProps(),
      isBrowse: false,
      isSelect: true,
      isAllSelected: true,
      onDeselectAll: deselectAllHandler,
    })
    mounted.push(deselectView)

    const deselectButton = Array.from(deselectView.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Deselect'),
    ) as HTMLButtonElement | undefined
    deselectButton?.click()

    expect(deselectAllHandler).toHaveBeenCalledTimes(1)
  })

  it('emits move and split mode navigation actions', () => {
    const cancelMoveHandler = vi.fn()
    const exitSplitHandler = vi.fn()

    const moveView = mountVueComponent(MobileTopBarView, {
      ...createBaseProps(),
      isBrowse: false,
      isMove: true,
      onCancelMove: cancelMoveHandler,
    })
    mounted.push(moveView)

    const moveCancel = Array.from(moveView.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cancel'),
    ) as HTMLButtonElement | undefined
    moveCancel?.click()
    expect(cancelMoveHandler).toHaveBeenCalledTimes(1)

    const splitView = mountVueComponent(MobileTopBarView, {
      ...createBaseProps(),
      isBrowse: false,
      isSplit: true,
      onExitSplit: exitSplitHandler,
    })
    mounted.push(splitView)

    const doneButton = Array.from(splitView.host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Done'),
    ) as HTMLButtonElement | undefined
    doneButton?.click()
    expect(exitSplitHandler).toHaveBeenCalledTimes(1)
  })
})
