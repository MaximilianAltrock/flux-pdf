import { storeToRefs } from 'pinia'
import { useSettingsStore } from '@/domains/settings/store/settings.store'

export function useSettingsPreferencesState() {
  const settingsStore = useSettingsStore()
  const { preferences } = storeToRefs(settingsStore)

  return {
    preferences,
    resetPreferences: settingsStore.resetPreferences,
    undoPreferences: settingsStore.undoPreferences,
    redoPreferences: settingsStore.redoPreferences,
    canUndoPreferences: settingsStore.canUndoPreferences,
    canRedoPreferences: settingsStore.canRedoPreferences,
    clearPreferencesHistory: settingsStore.clearPreferencesHistory,
  }
}
