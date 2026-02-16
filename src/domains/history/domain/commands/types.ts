import type { PageReference } from '@/types'

/**
 * Serialized form of a command for persistence
 */
export interface SerializedCommandPayload {
  /** Unique command instance identifier */
  id: string
  /** Additional command-specific data */
  [key: string]: unknown
}

/**
 * Serialized command envelope written to storage
 */
export interface SerializedCommand {
  /** Command type identifier (survives minification) */
  type: string
  /** Command-specific payload data */
  payload: SerializedCommandPayload
  /** When the command was executed */
  timestamp: number
}

/**
 * Base interface for all commands
 * Commands encapsulate mutations for undo/redo support
 */
export interface Command {
  /** Unique identifier for this command instance */
  readonly id: string

  /**
   * Stable type identifier for serialization
   * Must match a key in CommandType registry
   * IMPORTANT: This survives minification unlike class names
   */
  readonly type: string

  /** Human-readable description for history display */
  readonly name: string
  /** Stable display label used by history UI */
  readonly label: string

  /** Creation timestamp for ordering and serialization */
  readonly createdAt: number

  /** Execute the command (do/redo) */
  execute(): void

  /** Reverse the command (undo) */
  undo(): void

  /**
   * Serialize command state for persistence
   * Must capture all state needed to reconstruct the command
   */
  serialize(): SerializedCommand
}

/**
 * Constructor signature for command classes
 * Used by the registry for deserialization
 *
 * Note: We only require the static deserialize method since
 * concrete constructors have varying signatures.
 */
export interface CommandConstructor {
  /**
   * Deserialize a command from persisted state
   * Static factory method for reconstruction
   */
  deserialize(data: SerializedCommand): Command
}

/**
 * Snapshot of page state for undo operations
 * Used by commands that need to restore original positions
 */
export interface PageSnapshot {
  /** The page reference at time of snapshot */
  page: PageReference
  /** Original index in the pages array */
  index: number
}

/**
 * Command history entry with metadata
 */
export interface HistoryEntry {
  /** The command instance */
  command: Command
  /** When the command was executed */
  timestamp: number
}

/**
 * Displayed history entry with UI state
 */
export interface HistoryDisplayEntry extends HistoryEntry {
  /** Is this the current position in history? */
  isCurrent: boolean
  /** Has this been undone? */
  isUndone: boolean

  pointer: number
}

