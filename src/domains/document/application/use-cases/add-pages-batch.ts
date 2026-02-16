import { AddPagesCommand } from '@/domains/history/domain/commands'
import { executeCommandBatch, type HistoryBatchCommandExecutor } from '@/domains/history/application'
import type { Command } from '@/domains/history/domain/commands/types'
import type { PageReference, SourceFile } from '@/shared/types'

export interface AddPagesBatchEntry {
  sourceFile: SourceFile
  pages: PageReference[]
  shouldAddSource?: boolean
}

export function addPagesBatch(
  history: HistoryBatchCommandExecutor,
  entries: readonly AddPagesBatchEntry[],
  label?: string,
): Command | null {
  if (!entries || entries.length === 0) return null

  const commands = entries.map(
    (entry) => new AddPagesCommand(entry.sourceFile, entry.pages, entry.shouldAddSource ?? true),
  )
  return executeCommandBatch(history, commands, label)
}
