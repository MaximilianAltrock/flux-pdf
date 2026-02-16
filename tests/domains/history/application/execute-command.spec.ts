import { describe, expect, it, vi } from 'vitest'
import { executeCommand } from '@/domains/history/application/execute-command'
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

describe('executeCommand', () => {
  it('executes command via history executor and returns the same command instance', () => {
    const command = createCommand('Rotate pages')
    const history = { execute: vi.fn() }

    const result = executeCommand(history, command)

    expect(history.execute).toHaveBeenCalledOnce()
    expect(history.execute).toHaveBeenCalledWith(command)
    expect(result).toBe(command)
    expect(result.label).toBe('Rotate pages')
  })
})
