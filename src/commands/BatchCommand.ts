import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand, commandRegistry } from './registry'
import type { SerializedCommand, Command } from './types'

interface BatchPayload {
  id: string
  name: string
  commands: SerializedCommand[]
}

export class BatchCommand extends BaseCommand {
  public readonly type = CommandType.BATCH
  public readonly name: string

  private readonly commands: Command[]

  constructor(commands: Command[], name?: string, id?: string, createdAt?: number) {
    super(id, createdAt)
    this.commands = commands
    this.name = name ?? `Batch (${commands.length})`
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute()
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i]?.undo()
    }
  }

  // --- REQUIRED FOR PERSISTENCE ---

  protected getPayload(): Record<string, unknown> {
    // We must serialize the children so they can be saved to IDB
    return {
      name: this.name,
      commands: this.commands.map((c) => c.serialize()),
    }
  }

  static deserialize(data: SerializedCommand): BatchCommand {
    const payload = data.payload as unknown as BatchPayload
    const commands: Command[] = []

    // Recursively re-hydrate children commands
    for (const serializedChild of payload.commands) {
      const cmd = commandRegistry.deserialize(serializedChild)
      if (cmd) {
        commands.push(cmd)
      } else {
        console.warn('BatchCommand: Failed to restore child command', serializedChild.type)
      }
    }

    return new BatchCommand(commands, payload.name, payload.id, data.timestamp)
  }
}

// Self-register with the command registry
registerCommand(CommandType.BATCH, BatchCommand)
