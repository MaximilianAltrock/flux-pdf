import { COMMAND_SCHEMA_VERSION, type SerializedCommand } from './types'

export type SerializedCommandRecord = Omit<SerializedCommand, 'version'> & { version?: number }

export function migrateSerializedCommand(command: SerializedCommandRecord): SerializedCommand {
  const version = typeof command.version === 'number' ? command.version : 1

  switch (version) {
    case 1:
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
