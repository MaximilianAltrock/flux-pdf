import { describe, expect, it } from 'vitest'
import { createExportOperationState } from '@/domains/export/session/export-operation.state'

describe('createExportOperationState', () => {
  it('opens and closes export modal with selection intent', () => {
    const store = createExportOperationState()

    store.openExportModal(true)
    expect(store.showExportModal).toBe(true)
    expect(store.exportSelectedOnly).toBe(true)

    store.closeExportModal()
    expect(store.showExportModal).toBe(false)
    expect(store.exportSelectedOnly).toBe(true)
  })

  it('resets export job state', () => {
    const store = createExportOperationState()

    store.exportJob.status = 'error'
    store.exportJob.error = 'failure'
    store.exportJob.progress = 42
    store.resetExportJob()

    expect(store.exportJob.status).toBe('idle')
    expect(store.exportJob.error).toBeNull()
    expect(store.exportJob.progress).toBe(0)
  })
})
