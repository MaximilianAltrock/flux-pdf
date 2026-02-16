import { DuplicatePagesCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'

export function duplicatePages(
  history: HistoryCommandExecutor,
  sourcePageIds: string[],
): DuplicatePagesCommand {
  return executeCommand(history, new DuplicatePagesCommand(sourcePageIds))
}
