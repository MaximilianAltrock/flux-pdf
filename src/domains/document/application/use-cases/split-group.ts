import { SplitGroupCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'

export function splitGroup(history: HistoryCommandExecutor, index: number): SplitGroupCommand {
  return executeCommand(history, new SplitGroupCommand(index))
}
