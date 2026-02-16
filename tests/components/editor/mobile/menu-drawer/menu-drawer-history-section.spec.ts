import { afterEach, describe, expect, it, vi } from 'vitest'
import MenuDrawerHistorySection from '@/domains/editor/ui/components/mobile/menu-drawer/MenuDrawerHistorySection.vue'
import type { HistoryDisplayEntry, Command } from '@/domains/history/domain/commands'
import { mountVueComponent } from '../../../../utils/mount-vue-component'

function createCommand(name: string): Command {
  return {
    id: `cmd-${name}`,
    type: name,
    name,
    label: name,
    createdAt: 1,
    execute() {},
    undo() {},
    serialize() {
      return {
        type: name,
        payload: {},
        timestamp: 1,
      }
    },
  }
}

function createHistoryEntry(entry: {
  pointer: number
  name: string
  isCurrent?: boolean
  isUndone?: boolean
  timestamp?: number
}): HistoryDisplayEntry {
  return {
    command: createCommand(entry.name),
    timestamp: entry.timestamp ?? 1,
    pointer: entry.pointer,
    isCurrent: Boolean(entry.isCurrent),
    isUndone: Boolean(entry.isUndone),
  }
}

const mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  for (const view of mounted.splice(0)) {
    view.unmount()
  }
})

describe('MenuDrawerHistorySection', () => {
  it('shows empty history state when only root entry exists', () => {
    const view = mountVueComponent(MenuDrawerHistorySection, {
      historyList: [createHistoryEntry({ pointer: -1, name: 'Session Start', isCurrent: true })],
    })
    mounted.push(view)

    expect(view.host.textContent).toContain('No activity yet')
  })

  it('emits jump pointer when selecting a history entry', () => {
    const onJump = vi.fn()
    const view = mountVueComponent(MenuDrawerHistorySection, {
      historyList: [
        createHistoryEntry({ pointer: -1, name: 'Session Start' }),
        createHistoryEntry({ pointer: 0, name: 'Rotate page', isUndone: true, timestamp: 2 }),
        createHistoryEntry({ pointer: 1, name: 'Delete page', isCurrent: true, timestamp: 3 }),
      ],
      onJump,
    })
    mounted.push(view)

    const firstEntryButton = view.host.querySelector('button[type="button"]') as
      | HTMLButtonElement
      | null
    firstEntryButton?.click()

    expect(onJump).toHaveBeenCalledWith(1)
  })
})
