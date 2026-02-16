import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand, commandRegistry } from './registry'
import type { SerializedCommand, Command } from './types'

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

  protected getPayload(): Record<string, unknown> {
    // We must serialize the children so they can be saved to IDB
    return {
      name: this.name,
      commands: this.commands.map((c) => c.serialize()),
    }
  }

  static deserialize(data: SerializedCommand): BatchCommand {
    const {
      id,
      name,
      commands: serializedCommands,
    } = data.payload as {
      id: string
      name: string
      commands: SerializedCommand[]
    }
    const commands: Command[] = []

    // Recursively re-hydrate children commands
    for (const serializedChild of serializedCommands) {
      const cmd = commandRegistry.deserialize(serializedChild)
      if (cmd) {
        commands.push(cmd)
      } else {
        console.warn('BatchCommand: Failed to restore child command', serializedChild.type)
      }
    }

    return new BatchCommand(commands, name, id, data.timestamp)
  }
}

registerCommand(CommandType.BATCH, BatchCommand)

