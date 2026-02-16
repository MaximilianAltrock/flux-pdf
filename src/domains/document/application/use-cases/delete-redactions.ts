import { DeleteRedactionCommand } from '@/domains/history/domain/commands'
import { executeCommandBatch, type HistoryBatchCommandExecutor } from '@/domains/history/application'
import type { Command } from '@/domains/history/domain/commands/types'
import type { RedactionMark } from '@/shared/types'

export function deleteRedactions(
  history: HistoryBatchCommandExecutor,
  pageId: string,
  redactions: RedactionMark[],
): Command | null {
  if (!redactions || redactions.length === 0) return null

  const commands = redactions.map((redaction) => new DeleteRedactionCommand(pageId, redaction))
  const label =
    redactions.length === 1 ? 'Delete redaction' : `Delete ${redactions.length} redactions`
  return executeCommandBatch(history, commands, label)
}
