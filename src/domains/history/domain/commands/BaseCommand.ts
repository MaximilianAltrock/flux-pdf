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

}

