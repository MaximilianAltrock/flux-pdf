import type { PageReference } from '@/types'

/**
 * Base interface for all commands.
 * Commands encapsulate mutations for undo/redo support.
 */
export interface Command {
  /** Unique identifier for this command instance */
  readonly id: string
  /** Human-readable description for history display */
  readonly name: string
  /** Execute the command */
  execute(): void
  /** Reverse the command */
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
