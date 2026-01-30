import type { Command, CommandConstructor, SerializedCommand } from './types'

/**
 * Command type constants
 * These string values survive minification and are used for serialization
 */
export const CommandType = {
  ADD: 'AddPages',
  ADD_SOURCE: 'AddSource',
  DELETE: 'DeletePages',
  DUPLICATE: 'DuplicatePages',
  REORDER: 'ReorderPages',
  ROTATE: 'RotatePages',
  RESIZE: 'ResizePages',
  SPLIT: 'SplitGroup',
  REMOVE_SOURCE: 'RemoveSource',
  REDACT: 'AddRedaction',
  UPDATE_REDACTION: 'UpdateRedaction',
  DELETE_REDACTION: 'DeleteRedaction',
  BATCH: 'BatchCommand',
} as const

export type CommandTypeValue = (typeof CommandType)[keyof typeof CommandType]

/**
 * Command Registry
 *
 * Manages command class registration and deserialization.
 * Commands self-register when imported, enabling automatic
 * reconstruction from persisted state.
 */
class CommandRegistry {
  private readonly commands = new Map<string, CommandConstructor>()

  /**
   * Register a command class
   * Called automatically by command modules on import
   */
  register(type: string, constructor: CommandConstructor): void {
    if (this.commands.has(type)) {
      console.warn(`Command type "${type}" is already registered. Overwriting.`)
    }
    this.commands.set(type, constructor)
  }

  /**
   * Check if a command type is registered
   */
  has(type: string): boolean {
    return this.commands.has(type)
  }

  /**
   * Get all registered command types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.commands.keys())
  }

  /**
   * Deserialize a command from persisted state
   *
   * @param data - Serialized command data
   * @returns Reconstructed command instance, or null if type unknown
   */
  deserialize(data: SerializedCommand): Command | null {
    const Constructor = this.commands.get(data.type)

    if (!Constructor) {
      console.warn(
        `Unknown command type: "${data.type}". Registered types: ${this.getRegisteredTypes().join(', ')}`,
      )
      return null
    }

    try {
      return Constructor.deserialize(data)
    } catch (error) {
      console.error(`Failed to deserialize command "${data.type}":`, error)
      return null
    }
  }
}

/**
 * Global command registry instance
 * Commands register themselves when their modules are imported
 */
export const commandRegistry = new CommandRegistry()

/**
 * Decorator-style function to register a command class
 * Use at the bottom of each command file:
 *
 * @example
 * registerCommand(RotatePagesCommand.TYPE, RotatePagesCommand)
 */
export function registerCommand(type: string, constructor: CommandConstructor): void {
  commandRegistry.register(type, constructor)
}
