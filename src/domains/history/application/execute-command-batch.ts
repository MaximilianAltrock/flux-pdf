import { BatchCommand } from '@/domains/history/domain/commands'
import type { Command } from '@/domains/history/domain/commands/types'
import type { HistoryCommandExecutor } from './execute-command'

export interface HistoryBatchCommandExecutor extends HistoryCommandExecutor {
  executeBatch?: (commands: readonly Command[], label?: string) => Command | null
}

export function executeCommandBatch(
  history: HistoryBatchCommandExecutor,
  commands: readonly Command[],
  label?: string,
): Command | null {
  const validCommands = commands.filter((command): command is Command => Boolean(command))
  if (validCommands.length === 0) return null

  if (history.executeBatch) {
    return history.executeBatch(validCommands, label)
  }

  if (validCommands.length === 1) {
    const command = validCommands[0]
    if (!command) return null
    history.execute(command)
    return command
  }

  const batch = new BatchCommand([...validCommands], label)
  history.execute(batch)
  return batch
}
