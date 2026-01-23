import { BaseCommand } from './BaseCommand'
import { CommandType, registerCommand } from './registry'
import type { SerializedCommand } from './types'
import type { SourceFile } from '@/types'
import { useDocumentStore } from '@/stores/document'

interface AddSourcePayload {
  id: string
  sourceFile: SourceFile
}

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

    this.sourceFile = { ...sourceFile }
    this.name = `Add source "${sourceFile.filename}"`
  }

  execute(): void {
    const store = useDocumentStore()
    if (!store.sources.has(this.sourceFile.id)) {
      store.addSourceFile({ ...this.sourceFile })
    }
  }

  undo(): void {
    const store = useDocumentStore()
    store.removeSourceOnly(this.sourceFile.id)
  }

  protected getPayload(): Record<string, unknown> {
    return {
      sourceFile: this.sourceFile,
    }
  }

  static deserialize(data: SerializedCommand): AddSourceCommand {
    const payload = data.payload as unknown as AddSourcePayload
    return new AddSourceCommand(payload.sourceFile, payload.id, data.timestamp)
  }
}

registerCommand(CommandType.ADD_SOURCE, AddSourceCommand)
