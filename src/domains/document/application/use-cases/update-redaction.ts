import { UpdateRedactionCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { RedactionMark } from '@/shared/types'

export function updateRedaction(
  history: HistoryCommandExecutor,
  pageId: string,
  previous: RedactionMark,
  next: RedactionMark,
): UpdateRedactionCommand {
  return executeCommand(history, new UpdateRedactionCommand(pageId, previous, next))
}
