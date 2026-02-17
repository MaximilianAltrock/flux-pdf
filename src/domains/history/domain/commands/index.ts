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
 * import { RotatePagesCommand, commandRegistry } from '@/domains/history/domain/commands'
 * import { executeCommand } from '@/domains/history/application'
 * import { ROTATION_DELTA_DEGREES } from '@/shared/constants'
 *
 * // Create and execute a command through history
 * const cmd = new RotatePagesCommand(['page-1', 'page-2'], ROTATION_DELTA_DEGREES.RIGHT)
 * executeCommand(historyStore, cmd)
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
export { toJsonSafeSerializedCommand } from './serialization'

// Base class
export { BaseCommand } from './BaseCommand'

// Registry
export { CommandType, type CommandTypeValue, commandRegistry, registerCommand } from './registry'

// Commands (importing registers them with the registry)
export { AddPagesCommand } from './AddPagesCommand'
export { AddSourceCommand } from './AddSourceCommand'
export { DeletePagesCommand } from './DeletePagesCommand'
export { DuplicatePagesCommand } from './DuplicatePagesCommand'
export { ReorderPagesCommand } from './ReorderPagesCommand'
export { RotatePagesCommand } from './RotatePagesCommand'
export { ResizePagesCommand } from './ResizePagesCommand'
export { AddRedactionCommand } from './AddRedactionCommand'
export { UpdateRedactionCommand } from './UpdateRedactionCommand'
export { DeleteRedactionCommand } from './DeleteRedactionCommand'
export { SplitGroupCommand } from './SplitGroupCommand'
export { RemoveSourceCommand } from './RemoveSourceCommand'
export { UpdateOutlineCommand } from './UpdateOutlineCommand'
export { BatchCommand } from './BatchCommand'


