import { describe, expect, it, vi } from 'vitest'
import {
  AddPagesCommand,
  commandRegistry,
  registerCommand,
  type Command,
  COMMAND_SCHEMA_VERSION,
} from '@/commands'
import {
  migrateSerializedCommand,
  migrateSerializedCommands,
  type SerializedCommandRecord,
} from '@/commands/migrations'
import type { PageReference, SourceFile } from '@/types'

describe('command migrations', () => {
  it('migrates legacy serialized commands without versions', () => {
    const legacy: SerializedCommandRecord = {
      type: 'AddPages',
      payload: { id: 'legacy-cmd' },
      timestamp: 1,
    }

    const migrated = migrateSerializedCommand(legacy)
    expect(migrated.version).toBe(1)
  })

  it('migrates arrays and preserves explicit versions', () => {
    const legacy: SerializedCommandRecord = {
      type: 'RotatePages',
      payload: { id: 'legacy-cmd' },
      timestamp: 2,
    }

    const current: SerializedCommandRecord = {
      type: 'AddPages',
      version: 1,
      payload: { id: 'current-cmd' },
      timestamp: 3,
    }

    const migrated = migrateSerializedCommands([legacy, current])

    expect(migrated).toHaveLength(2)
    expect(migrated[0]?.version).toBe(1)
    expect(migrated[1]?.version).toBe(1)
  })
})

describe('commandRegistry.deserialize', () => {
  it('rehydrates commands missing version metadata', () => {
    const source: SourceFile = {
      id: 'source-1',
      filename: 'source.pdf',
      pageCount: 1,
      fileSize: 123,
      addedAt: Date.now(),
      color: '#000000',
    }

    const pages: PageReference[] = [
      {
        id: 'page-1',
        sourceFileId: source.id,
        sourcePageIndex: 0,
        rotation: 0,
        groupId: 'group-1',
      },
    ]

    const cmd = new AddPagesCommand(source, pages, true, 'cmd-1', 123)
    const serialized = cmd.serialize()
    const legacy = { ...serialized } as SerializedCommandRecord
    delete legacy.version

    const restored = commandRegistry.deserialize(legacy)

    expect(restored).not.toBeNull()
    expect(restored?.type).toBe(cmd.type)
    expect(restored?.id).toBe(cmd.id)
  })

  it('returns null and warns for unknown command types', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unknown: SerializedCommandRecord = {
      type: 'UnknownCommandType',
      payload: { id: 'unknown-cmd' },
      timestamp: 0,
    }

    const restored = commandRegistry.deserialize(unknown)

    expect(restored).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('Unknown command type')
    warnSpy.mockRestore()
  })

  it('returns null and logs errors when deserialization fails', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const invalid = {
      type: 'AddPages',
      payload: { id: 'bad-cmd', sourceFile: null, pages: [] },
      timestamp: 0,
    } as unknown as SerializedCommandRecord

    const restored = commandRegistry.deserialize(invalid)

    expect(restored).toBeNull()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('Failed to deserialize command')
    errorSpy.mockRestore()
  })
})

describe('commandRegistry.register', () => {
  it('warns on duplicate registration and uses the latest constructor', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const type = `TestCommand-${crypto.randomUUID()}`

    const makeCommand = (id: string): Command => ({
      id,
      type,
      name: id,
      createdAt: 0,
      execute() {},
      undo() {},
      serialize() {
        return {
          version: COMMAND_SCHEMA_VERSION,
          type,
          payload: { id },
          timestamp: 0,
        }
      },
    })

    const first = {
      deserialize: () => makeCommand('first'),
    }
    const second = {
      deserialize: () => makeCommand('second'),
    }

    registerCommand(type, first)
    registerCommand(type, second)

    const restored = commandRegistry.deserialize({
      type,
      payload: { id: 'payload' },
      timestamp: 0,
    })

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(restored?.id).toBe('second')
    warnSpy.mockRestore()
  })
})
