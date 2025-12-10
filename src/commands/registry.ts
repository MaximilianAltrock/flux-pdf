import type { Command } from './types'
import {
  RotatePagesCommand,
  DeletePagesCommand,
  ReorderPagesCommand,
  AddPagesCommand,
  DuplicatePagesCommand,
  SplitGroupCommand,
} from './index'

// Interface that all Commands must implement to be saved
export interface SerializableCommand extends Command {
  serialize(): any
}

export const CommandType = {
  ROTATE: 'RotatePages',
  DELETE: 'DeletePages',
  REORDER: 'ReorderPages',
  ADD: 'AddPages',
  DUPLICATE: 'DuplicatePages',
  SPLIT: 'SplitGroup',
} as const

/**
 * Rehydrates a raw JSON object back into a Functional Class Instance
 */
export function rehydrateCommand(type: string, payload: any): Command | null {
  try {
    switch (type) {
      case CommandType.ROTATE:
        return new RotatePagesCommand(payload.pageIds, payload.degrees)

      case CommandType.DELETE:
        return new DeletePagesCommand(payload.pageIds) // Note: Undo logic for delete needs careful handling of page data restoration

      case CommandType.REORDER:
        return new ReorderPagesCommand(payload.previousOrder, payload.newOrder)

      case CommandType.ADD:
        // AddPagesCommand is tricky because it usually needs SourceFile info
        // We assume payload contains sourceFile metadata and pageRefs
        return new AddPagesCommand(payload.sourceFile, payload.pages, payload.shouldAddSource)

      case CommandType.DUPLICATE:
        return new DuplicatePagesCommand(payload.pageIds)

      case CommandType.SPLIT:
        return new SplitGroupCommand(payload.index)

      default:
        console.warn(`Unknown command type: ${type}`)
        return null
    }
  } catch (e) {
    console.error(`Failed to rehydrate command ${type}`, e)
    return null
  }
}
