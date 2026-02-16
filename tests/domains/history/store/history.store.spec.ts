import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHistoryStore } from '@/domains/history/store/history.store'
import type { Command } from '@/domains/history/domain/commands/types'

function createCommand(
  label = 'Test label',
  hooks?: { onExecute?: () => void; onUndo?: () => void },
): Command {
  return {
    id: crypto.randomUUID(),
    type: 'Test',
    name: 'Test name',
    label,
    createdAt: Date.now(),
    execute: vi.fn(() => hooks?.onExecute?.()),
    undo: vi.fn(() => hooks?.onUndo?.()),
    serialize: () => ({
      type: 'Test',
      payload: { id: 'x' },
      timestamp: Date.now(),
    }),
  }
}

describe('useHistoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses command label for undo/redo names', () => {
    const store = useHistoryStore()
    const command = createCommand('Rotate 2 pages')

    store.execute(command)

    expect(command.execute).toHaveBeenCalledOnce()
    expect(store.undoName).toBe('Rotate 2 pages')
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(false)

    store.undo()

    expect(command.undo).toHaveBeenCalledOnce()
    expect(store.redoName).toBe('Rotate 2 pages')
    expect(store.canRedo).toBe(true)
  })

  it('executes grouped commands as a single history entry and undoes in reverse order', () => {
    const store = useHistoryStore()
    const callOrder: string[] = []
    const first = createCommand('First', {
      onExecute: () => callOrder.push('execute:first'),
      onUndo: () => callOrder.push('undo:first'),
    })
    const second = createCommand('Second', {
      onExecute: () => callOrder.push('execute:second'),
      onUndo: () => callOrder.push('undo:second'),
    })

    const result = store.executeBatch([first, second], 'Grouped edit')

    expect(result?.label).toBe('Grouped edit')
    expect(store.history).toHaveLength(1)
    expect(store.undoName).toBe('Grouped edit')
    expect(callOrder).toEqual(['execute:first', 'execute:second'])

    store.undo()
    expect(callOrder).toEqual([
      'execute:first',
      'execute:second',
      'undo:second',
      'undo:first',
    ])

    store.redo()
    expect(callOrder).toEqual([
      'execute:first',
      'execute:second',
      'undo:second',
      'undo:first',
      'execute:first',
      'execute:second',
    ])
  })
})
