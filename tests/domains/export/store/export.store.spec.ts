import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useExportStore } from '@/domains/export/store/export.store'

describe('useExportStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens and closes export modal with selection intent', () => {
    const store = useExportStore()

    store.openExportModal(true)
    expect(store.showExportModal).toBe(true)
    expect(store.exportSelectedOnly).toBe(true)

    store.closeExportModal()
    expect(store.showExportModal).toBe(false)
    expect(store.exportSelectedOnly).toBe(true)
  })

  it('resets export job state', () => {
    const store = useExportStore()

    store.exportJob.status = 'error'
    store.exportJob.error = 'failure'
    store.exportJob.progress = 42
    store.resetExportJob()

    expect(store.exportJob.status).toBe('idle')
    expect(store.exportJob.error).toBeNull()
    expect(store.exportJob.progress).toBe(0)
  })
})
