import { DeletePagesCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'

export function deletePages(
  history: HistoryCommandExecutor,
  pageIds: string[],
): DeletePagesCommand {
  return executeCommand(history, new DeletePagesCommand(pageIds))
}
