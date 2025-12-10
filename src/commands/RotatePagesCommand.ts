import { CommandType } from './registry'
import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'

export class RotatePagesCommand implements Command {
  public readonly type = CommandType.ROTATE
  public readonly id: string
  public readonly name: string

  public pageIds: string[]
  public degrees: 90 | -90

  constructor(pageIds: string[], degrees: 90 | -90) {
    this.id = crypto.randomUUID()
    this.pageIds = [...pageIds]
    this.degrees = degrees

    const count = pageIds.length
    const direction = degrees > 0 ? 'right' : 'left'
    this.name = count === 1 ? `Rotate page ${direction}` : `Rotate ${count} pages ${direction}`
  }

  execute(): void {
    const store = useDocumentStore()
    for (const pageId of this.pageIds) {
      store.rotatePage(pageId, this.degrees)
    }
  }

  undo(): void {
    const store = useDocumentStore()
    const reverseDegrees = (this.degrees === 90 ? -90 : 90) as 90 | -90
    for (const pageId of this.pageIds) {
      store.rotatePage(pageId, reverseDegrees)
    }
  }
}
