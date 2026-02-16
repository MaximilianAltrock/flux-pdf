import { DeleteRedactionCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { RedactionMark } from '@/shared/types'

export function deleteRedaction(
  history: HistoryCommandExecutor,
  pageId: string,
  redaction: RedactionMark,
): DeleteRedactionCommand {
  return executeCommand(history, new DeleteRedactionCommand(pageId, redaction))
}
