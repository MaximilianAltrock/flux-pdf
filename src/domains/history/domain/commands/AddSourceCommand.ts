import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { SourceFile } from '@/shared/types'
import { cloneSourceFile } from '@/shared/utils/document-clone'

/**
 * Command to add a source file to the registry (without inserting pages).
 */
export class AddSourceCommand extends BaseCommand {
  public readonly type = CommandType.ADD_SOURCE
  public readonly name: string
  public readonly sourceFile: SourceFile

  constructor(sourceFile: SourceFile, id?: string, createdAt?: number) {
    super(id, createdAt)

    if (!sourceFile?.id) {
      throw new Error('AddSourceCommand requires a valid source file')
    }

    this.sourceFile = cloneSourceFile(sourceFile)
    this.name = `Add source "${sourceFile.filename}"`
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourceFile: cloneSourceFile(this.sourceFile),
    }
  }

  static deserialize(data: SerializedCommand): AddSourceCommand {
    const { id, sourceFile } = data.payload as { id: string; sourceFile: SourceFile }
    return new AddSourceCommand(sourceFile, id, data.timestamp)
  }
}

registerCommand(CommandType.ADD_SOURCE, AddSourceCommand)

