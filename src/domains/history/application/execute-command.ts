import type { Command } from '@/domains/history/domain/commands/types'

export interface HistoryCommandExecutor {
  execute: (command: Command) => void
}

export function executeCommand<TCommand extends Command>(
  history: HistoryCommandExecutor,
  command: TCommand,
): TCommand {
  history.execute(command)
  return command
}
