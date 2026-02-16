import { describe, expect, it, vi } from 'vitest'
import { BatchCommand } from '@/domains/history/domain/commands'
import { executeCommandBatch } from '@/domains/history/application/execute-command-batch'
import type { Command } from '@/domains/history/domain/commands/types'

function createCommand(label = 'Test command'): Command {
  return {
    id: crypto.randomUUID(),
    type: 'Test',
    name: label,
    label,
    createdAt: Date.now(),
    execute: vi.fn(),
    undo: vi.fn(),
    serialize: () => ({
      type: 'Test',
      payload: { id: 'x' },
      timestamp: Date.now(),
    }),
  }
}

describe('executeCommandBatch', () => {
  it('returns null when no commands are provided', () => {
    const history = { execute: vi.fn() }

    const result = executeCommandBatch(history, [])

    expect(result).toBeNull()
    expect(history.execute).not.toHaveBeenCalled()
  })

  it('executes a single command without wrapping into a batch', () => {
    const history = { execute: vi.fn() }
    const command = createCommand('Rotate page')

    const result = executeCommandBatch(history, [command], 'ignored label')

    expect(result).toBe(command)
    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
  })

  it('wraps multiple commands into BatchCommand when executeBatch is unavailable', () => {
    const history = { execute: vi.fn() }
    const first = createCommand('First')
    const second = createCommand('Second')

    const result = executeCommandBatch(history, [first, second], 'Combined edit')

    expect(result).toBeInstanceOf(BatchCommand)
    expect(history.execute).toHaveBeenCalledOnce()
    const [batch] = history.execute.mock.calls[0] ?? []
    expect(batch).toBeInstanceOf(BatchCommand)
    expect((batch as BatchCommand).name).toBe('Combined edit')
  })

  it('delegates to history.executeBatch when available', () => {
    const history = {
      execute: vi.fn(),
      executeBatch: vi.fn().mockReturnValue(createCommand('Batch proxy')),
    }
    const first = createCommand('First')
    const second = createCommand('Second')

    const result = executeCommandBatch(history, [first, second], 'Batch label')

    expect(history.executeBatch).toHaveBeenCalledOnce()
    expect(history.executeBatch).toHaveBeenCalledWith([first, second], 'Batch label')
    expect(history.execute).not.toHaveBeenCalled()
    expect(result?.label).toBe('Batch proxy')
  })
})
