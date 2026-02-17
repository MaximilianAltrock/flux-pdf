import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand, commandRegistry } from './registry'
import type { SerializedCommand, Command } from './types'
import { createLogger } from '@/shared/infrastructure/logger'

export class BatchCommand extends BaseCommand {
  private static readonly log = createLogger('history-batch-command')
  public readonly type = CommandType.BATCH
  public readonly name: string

  private readonly children: Command[]

  constructor(commands: Command[], name?: string, id?: string, createdAt?: number) {
    super(id, createdAt)
    this.children = [...commands]
    this.name = name ?? `Batch (${commands.length})`
  }

  getCommands(): readonly Command[] {
    return this.children
  }

  protected getPayload(): Record<string, unknown> {
    // We must serialize the children so they can be saved to IDB
    return {
      name: this.name,
      commands: this.children.map((c) => c.serialize()),
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
        BatchCommand.log.warn('Failed to restore child command', serializedChild.type)
      }
    }

    return new BatchCommand(commands, name, id, data.timestamp)
  }
}

registerCommand(CommandType.BATCH, BatchCommand)

