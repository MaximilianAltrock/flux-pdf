import { describe, expect, it } from 'vitest'
import {
  toJsonSafeSerializedCommand,
  type SerializedCommand,
} from '@/domains/history/domain/commands'

function createSerialized(payload?: Record<string, unknown>): SerializedCommand {
  return {
    type: 'Test',
    payload: {
      id: 'cmd-1',
      ...payload,
    },
    timestamp: Date.now(),
  }
}

describe('toJsonSafeSerializedCommand', () => {
  it('returns a deep plain clone when payload is JSON-safe', () => {
    const serialized = createSerialized({
      pageIds: ['a', 'b'],
      nested: {
        count: 2,
      },
    })

    const normalized = toJsonSafeSerializedCommand(serialized)

    expect(normalized).toEqual(serialized)
    expect(normalized).not.toBe(serialized)
    expect(normalized.payload).not.toBe(serialized.payload)
  })

  it('rejects payloads containing Date values', () => {
    const serialized = createSerialized({
      createdAt: new Date(),
    })

    expect(() => toJsonSafeSerializedCommand(serialized)).toThrow('Date')
  })

  it('rejects payloads containing binary data', () => {
    const serialized = createSerialized({
      bytes: new Uint8Array([1, 2, 3]),
    })

    expect(() => toJsonSafeSerializedCommand(serialized)).toThrow('binary data')
  })
})
