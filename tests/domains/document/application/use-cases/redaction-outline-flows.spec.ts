import { describe, expect, it, vi } from 'vitest'
import {
  addRedaction,
  deleteRedaction,
  deleteRedactions,
  updateOutlineTree,
  updateRedaction,
} from '@/domains/document/application/use-cases'
import {
  AddRedactionCommand,
  BatchCommand,
  DeleteRedactionCommand,
  UpdateOutlineCommand,
  UpdateRedactionCommand,
} from '@/domains/history/domain/commands'
import type { OutlineNode, RedactionMark } from '@/shared/types'

function createRedaction(id: string): RedactionMark {
  return {
    id,
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    color: 'black',
  }
}

describe('redaction and outline command use-cases', () => {
  it('delegates add redaction to history execution', () => {
    const history = { execute: vi.fn() }
    const redaction = createRedaction('r-1')

    const command = addRedaction(history, 'page-1', redaction)

    expect(command).toBeInstanceOf(AddRedactionCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates update redaction to history execution', () => {
    const history = { execute: vi.fn() }
    const previous = createRedaction('r-1')
    const next = { ...previous, width: 60 }

    const command = updateRedaction(history, 'page-1', previous, next)

    expect(command).toBeInstanceOf(UpdateRedactionCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates delete redaction to history execution', () => {
    const history = { execute: vi.fn() }
    const redaction = createRedaction('r-1')

    const command = deleteRedaction(history, 'page-1', redaction)

    expect(command).toBeInstanceOf(DeleteRedactionCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('ignores empty redaction collections', () => {
    const history = { execute: vi.fn() }

    const command = deleteRedactions(history, 'page-1', [])

    expect(command).toBeNull()
    expect(history.execute).not.toHaveBeenCalled()
  })

  it('delegates delete redaction batches to executeBatch when available', () => {
    const batchProxy = new AddRedactionCommand('page-1', [createRedaction('proxy')])
    const history = {
      execute: vi.fn(),
      executeBatch: vi.fn().mockReturnValue(batchProxy),
    }
    const first = createRedaction('r-1')
    const second = createRedaction('r-2')

    const command = deleteRedactions(history, 'page-1', [first, second])

    expect(command).toBe(batchProxy)
    expect(history.executeBatch).toHaveBeenCalledOnce()
    const [commands, label] = history.executeBatch.mock.calls[0] ?? []
    expect(Array.isArray(commands)).toBe(true)
    expect(commands).toHaveLength(2)
    expect(commands[0]).toBeInstanceOf(DeleteRedactionCommand)
    expect(commands[1]).toBeInstanceOf(DeleteRedactionCommand)
    expect(label).toBe('Delete 2 redactions')
    expect(history.execute).not.toHaveBeenCalled()
  })

  it('falls back to a BatchCommand when executeBatch is unavailable', () => {
    const history = { execute: vi.fn() }
    const first = createRedaction('r-1')
    const second = createRedaction('r-2')

    const command = deleteRedactions(history, 'page-1', [first, second])

    expect(command).toBeInstanceOf(BatchCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('delegates outline updates to history execution', () => {
    const history = { execute: vi.fn() }
    const nextTree: OutlineNode[] = [
      {
        id: 'node-1',
        parentId: null,
        title: 'Node 1',
        expanded: true,
        dest: {
          type: 'none',
        },
        children: [],
      },
    ]

    const command = updateOutlineTree(history, {
      previousTree: [],
      nextTree,
      previousDirty: false,
      nextDirty: true,
      name: 'Update outline test',
    })

    expect(command).toBeInstanceOf(UpdateOutlineCommand)
    expect(command.name).toBe('Update outline test')
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })
})
