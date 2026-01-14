import { COMMAND_SCHEMA_VERSION } from './types'
import type { SerializedCommand } from './types'

export type SerializedCommandRecord = Omit<SerializedCommand, 'version'> & { version?: number }

export function migrateSerializedCommand(command: SerializedCommandRecord): SerializedCommand {
  const version =
    typeof command.version === 'number' ? command.version : COMMAND_SCHEMA_VERSION

  switch (version) {
    case COMMAND_SCHEMA_VERSION:
      return { ...command, version }
    default:
      return { ...command, version }
  }
}

export function migrateSerializedCommands(
  commands: SerializedCommandRecord[] = [],
): SerializedCommand[] {
  return commands.map((command) => migrateSerializedCommand(command))
}
