import type { PageReference } from '@/types'

/**
 * Base interface for all commands.
 * Commands encapsulate mutations for undo/redo support.
 */
export interface Command {
  /** Unique identifier for this command instance */
  readonly id: string
  /**
   * Stable identifier for serialization (SURVIVES MINIFICATION)
   * Must match a key in CommandType registry
   */
  readonly type: string
  /** Human-readable description for history display */
  readonly name: string

  execute(): void
  undo(): void
}

/**
 * Snapshot of page state for undo operations
 */
export interface PageSnapshot {
  pages: PageReference[]
}

/**
 * Command history entry with metadata
 */
export interface HistoryEntry {
  command: Command
  timestamp: number
}
