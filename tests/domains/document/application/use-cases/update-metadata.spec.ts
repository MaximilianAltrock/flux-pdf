import { describe, expect, it, vi } from 'vitest'
import { updateMetadata } from '@/domains/document/application/use-cases/update-metadata'

describe('updateMetadata', () => {
  it('marks metadata dirty by default', () => {
    const store = { setMetadata: vi.fn() }

    updateMetadata(store, { title: 'Updated title' })

    expect(store.setMetadata).toHaveBeenCalledOnce()
    expect(store.setMetadata).toHaveBeenCalledWith({ title: 'Updated title' }, true)
  })

  it('allows explicit markDirty override', () => {
    const store = { setMetadata: vi.fn() }

    updateMetadata(store, { author: 'Alice' }, { markDirty: false })

    expect(store.setMetadata).toHaveBeenCalledOnce()
    expect(store.setMetadata).toHaveBeenCalledWith({ author: 'Alice' }, false)
  })
})
