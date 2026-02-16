import { AddSourceCommand } from '@/domains/history/domain/commands'
import { executeCommandBatch, type HistoryBatchCommandExecutor } from '@/domains/history/application'
import type { Command } from '@/domains/history/domain/commands/types'
import type { SourceFile } from '@/shared/types'

export function addSources(
  history: HistoryBatchCommandExecutor,
  sourceFiles: readonly SourceFile[],
  label?: string,
): Command | null {
  if (!sourceFiles || sourceFiles.length === 0) return null
  const commands = sourceFiles.map((sourceFile) => new AddSourceCommand(sourceFile))
  return executeCommandBatch(history, commands, label)
}
