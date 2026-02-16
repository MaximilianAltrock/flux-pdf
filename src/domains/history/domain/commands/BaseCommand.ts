import { type Command, type SerializedCommand } from './types'

/**
 * Abstract base class for all commands
 *
 * Provides:
 * - Automatic ID generation
 * - Consistent serialization pattern
 * - Common timestamp handling
 *
 * Subclasses must:
 * - Define `type` using a CommandType constant
 * - Implement `execute()` and `undo()`
 * - Implement `getPayload()` for serialization
 * - Implement static `deserialize()` for reconstruction
 */
export abstract class BaseCommand implements Command {
  public readonly id: string
  public abstract readonly type: string
  public abstract readonly name: string
  public get label(): string {
    return this.name
  }

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
      type: this.type,
      payload: {
        id: this.id,
        ...this.getPayload(),
      },
      timestamp: this.createdAt,
    }
  }

  /**
   * Helper to shallow clone page references
   * TODO: Move defensive copying to the store layer for consistent ownership model
   */
  protected static clonePages<T>(pages: T[]): T[] {
    return pages.map((p) => ({ ...p }))
  }
}

