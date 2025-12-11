/**
 * Command System
 *
 * Implements the Command Pattern for undo/redo functionality.
 * All document mutations go through commands to enable history tracking.
 *
 * Architecture:
 * - BaseCommand: Abstract base class with common functionality
 * - CommandRegistry: Manages command types and deserialization
 * - Individual Commands: Concrete implementations for each action
 *
 * Usage:
 * ```ts
 * import { RotatePagesCommand, commandRegistry } from '@/commands'
 *
 * // Create and execute a command
 * const cmd = new RotatePagesCommand(['page-1', 'page-2'], 90)
 * cmd.execute()
 *
 * // Serialize for persistence
 * const serialized = cmd.serialize()
 *
 * // Deserialize from storage
 * const restored = commandRegistry.deserialize(serialized)
 * ```
 */

// Types
export type {
  Command,
  CommandConstructor,
  SerializedCommand,
  SerializedCommandPayload,
  PageSnapshot,
  HistoryEntry,
  HistoryDisplayEntry,
} from './types'

// Base class
export { BaseCommand } from './BaseCommand'

// Registry
export { CommandType, type CommandTypeValue, commandRegistry, registerCommand } from './registry'

// Commands (importing registers them with the registry)
export { AddPagesCommand } from './AddPagesCommand'
export { DeletePagesCommand } from './DeletePagesCommand'
export { DuplicatePagesCommand } from './DuplicatePagesCommand'
export { ReorderPagesCommand } from './ReorderPagesCommand'
export { RotatePagesCommand } from './RotatePagesCommand'
export { SplitGroupCommand } from './SplitGroupCommand'
export { RemoveSourceCommand } from './RemoveSourceCommand'
