import { describe, expect, it } from 'vitest'
import { AddPagesCommand, commandRegistry } from '@/commands'
import { migrateSerializedCommand, type SerializedCommandRecord } from '@/commands/migrations'
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
})
