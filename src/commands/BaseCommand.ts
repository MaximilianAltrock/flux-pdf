import { COMMAND_SCHEMA_VERSION, type Command, type SerializedCommand } from './types'

/**
 * Abstract base class for all commands
 *
 * Provides:
 * - Automatic ID generation
 * - Consistent serialization pattern
 * - Common timestamp handling
 *
 * Subclasses must:
 * - Define static `TYPE` constant
 * - Implement `execute()` and `undo()`
 * - Implement `getPayload()` for serialization
 * - Implement static `deserialize()` for reconstruction
 */
export abstract class BaseCommand implements Command {
  public readonly id: string
  public abstract readonly type: string
  public abstract readonly name: string

  /** Timestamp when command was created (for ordering) */
  public readonly createdAt: number

  constructor(id?: string, createdAt?: number) {
    this.id = id ?? crypto.randomUUID()
    this.createdAt = createdAt ?? Date.now()
  }

  /**
   * Execute the command
   * Called on initial execution and redo
   */
  abstract execute(): void

  /**
   * Undo the command
   * Must perfectly reverse execute()
   */
  abstract undo(): void

  /**
   * Get command-specific payload for serialization
   * Subclasses return their state as a plain object
   */
  protected abstract getPayload(): Record<string, unknown>

  /**
   * Serialize command for persistence
   * Uses getPayload() to get command-specific data
   */
  serialize(): SerializedCommand {
    return {
      version: COMMAND_SCHEMA_VERSION,
      type: this.type,
      payload: {
        id: this.id,
        ...this.getPayload(),
      },
      timestamp: this.createdAt,
    }
  }

  /**
   * Helper to generate descriptive names
   */
  protected static formatName(action: string, count: number, item = 'page'): string {
    if (count === 1) {
      return `${action} ${item}`
    }
    return `${action} ${count} ${item}s`
  }

  /**
   * Helper to deep clone page references
   * Ensures command state is isolated from store mutations
   */
  protected static clonePages<T>(pages: T[]): T[] {
    return pages.map((p) => ({ ...p }))
  }
}
