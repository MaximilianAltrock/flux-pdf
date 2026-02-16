import { AddRedactionCommand } from '@/domains/history/domain/commands'
import { executeCommand, type HistoryCommandExecutor } from '@/domains/history/application'
import type { RedactionMark } from '@/shared/types'

export function addRedaction(
  history: HistoryCommandExecutor,
  pageId: string,
  redaction: RedactionMark,
): AddRedactionCommand {
  return executeCommand(history, new AddRedactionCommand(pageId, [redaction]))
}
