import type { Command } from './types'
import { useDocumentStore } from '@/stores/document'

/**
 * Command to rotate one or more pages
 */
export class RotatePagesCommand implements Command {
  readonly id: string
  readonly name: string
  
  private pageIds: string[]
  private degrees: 90 | -90
  private store = useDocumentStore()

  constructor(pageIds: string[], degrees: 90 | -90) {
    this.id = crypto.randomUUID()
    this.pageIds = [...pageIds]
    this.degrees = degrees
    
    const count = pageIds.length
    const direction = degrees > 0 ? 'right' : 'left'
    this.name = count === 1 
      ? `Rotate page ${direction}` 
      : `Rotate ${count} pages ${direction}`
  }

  execute(): void {
    for (const pageId of this.pageIds) {
      this.store.rotatePage(pageId, this.degrees)
    }
  }

  undo(): void {
    // Rotate in opposite direction
    const reverseDegrees = (this.degrees === 90 ? -90 : 90) as 90 | -90
    for (const pageId of this.pageIds) {
      this.store.rotatePage(pageId, reverseDegrees)
    }
  }
}
