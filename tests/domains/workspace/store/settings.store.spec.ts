import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import {
  DEFAULT_SETTINGS_PREFERENCES,
  useSettingsStore,
} from '@/domains/workspace/store/settings.store'

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('supports lightweight undo/redo history for preferences', async () => {
    const store = useSettingsStore()

    store.preferences.defaultAuthor = 'Bob'
    await nextTick()

    expect(store.canUndoPreferences).toBe(true)
    expect(store.preferences.defaultAuthor).toBe('Bob')

    store.undoPreferences()
    await nextTick()
    expect(store.preferences.defaultAuthor).toBe('')
    expect(store.canRedoPreferences).toBe(true)

    store.redoPreferences()
    await nextTick()
    expect(store.preferences.defaultAuthor).toBe('Bob')
  })

  it('resets preferences to defaults', () => {
    const store = useSettingsStore()

    store.preferences.theme = 'dark'
    store.preferences.defaultGridZoom = 300
    store.resetPreferences()

    expect(store.preferences).toEqual({ ...DEFAULT_SETTINGS_PREFERENCES })
  })
})
