import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useDocumentStore } from '@/stores/document'
import { db, type SessionState } from '@/db/db'
import { rehydrateCommand } from '@/commands/registry'
import type { Command, HistoryEntry } from '@/commands/types'

/**
 * Maximum number of commands to keep in history
 */
const MAX_HISTORY_SIZE = 50

/**
 * Global command history state (singleton)
 * Defined outside to persist across component mounts
 */
const history = ref<HistoryEntry[]>([])
const historyPointer = ref(-1)

export function useCommandManager() {
  const store = useDocumentStore()

  // ==========================================
  // Persistence Logic (IndexedDB)
  // ==========================================

  /**
   * Save the current session state to IndexedDB.
   * Debounced by 1s via VueUse to prevent database thrashing.
   */
  const saveSession = useDebounceFn(async () => {
    // 1. Serialize History
    const serializedHistory = history.value.map((entry) => {
      // PRODUCTION FIX: Use the explicit 'type' property
      // This string is constant and will not be mangled by minifiers.
      if (!entry.command.type) {
        console.error('Command missing type property during serialization:', entry.command)
      }

      return {
        type: entry.command.type,
        // We assume all public properties on the Command class are needed for state restoration.
        // JSON.stringify automatically drops functions (execute/undo), leaving only data.
        payload: JSON.parse(JSON.stringify(entry.command)),
        timestamp: entry.timestamp,
      }
    })

    // 2. Construct Session Object
    const sessionData: SessionState = {
      id: 'current-session',
      projectTitle: store.projectTitle,
      // Deep copy pages array to avoid reactivity issues during storage
      pageMap: JSON.parse(JSON.stringify(store.pages)),
      history: serializedHistory,
      historyPointer: historyPointer.value,
      zoom: store.zoom,
      updatedAt: Date.now(),
    }

    // 3. Write to DB
    try {
      await db.session.put(sessionData)
    } catch (e) {
      console.error('Failed to save session to IndexedDB:', e)
    }
  }, 1000)

  /**
   * Watch for state changes to trigger auto-save
   */
  watch(
    [historyPointer, () => store.pages, () => store.projectTitle],
    () => {
      saveSession()
    },
    { deep: true },
  )

  /**
   * Restore the history stack from IndexedDB on app launch
   */
  async function restoreHistory() {
    try {
      const session = await db.session.get('current-session')
      if (!session || !session.history) return

      const rehydratedEntries: HistoryEntry[] = []

      for (const item of session.history) {
        // Factory method to convert JSON -> Class Instance
        const command = rehydrateCommand(item.type, item.payload)

        if (command) {
          rehydratedEntries.push({
            command,
            timestamp: item.timestamp,
          })
        } else {
          console.warn(`Skipping unknown command type during restore: ${item.type}`)
        }
      }

      history.value = rehydratedEntries
      historyPointer.value = session.historyPointer
    } catch (e) {
      console.error('Failed to restore history:', e)
    }
  }

  // ==========================================
  // Standard Command Logic
  // ==========================================

  const canUndo = computed(() => historyPointer.value >= 0)
  const canRedo = computed(() => historyPointer.value < history.value.length - 1)

  const undoName = computed(() => {
    if (!canUndo.value) return null
    return history.value[historyPointer.value]?.command.name ?? null
  })

  const redoName = computed(() => {
    if (!canRedo.value) return null
    return history.value[historyPointer.value + 1]?.command.name ?? null
  })

  const historyList = computed(() =>
    history.value.map((entry, index) => ({
      ...entry,
      isCurrent: index === historyPointer.value,
      isUndone: index > historyPointer.value,
    })),
  )

  function execute(command: Command): void {
    // If we're in the middle of history, discard the "future"
    if (historyPointer.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyPointer.value + 1)
    }

    command.execute()

    history.value.push({
      command,
      timestamp: Date.now(),
    })

    // Trim history if too long to save memory
    if (history.value.length > MAX_HISTORY_SIZE) {
      history.value = history.value.slice(-MAX_HISTORY_SIZE)
    }

    historyPointer.value = history.value.length - 1
  }

  function undo(): boolean {
    if (!canUndo.value) return false

    const entry = history.value[historyPointer.value]
    if (!entry) return false

    entry.command.undo()
    historyPointer.value--

    return true
  }

  function redo(): boolean {
    if (!canRedo.value) return false

    historyPointer.value++
    const entry = history.value[historyPointer.value]
    if (!entry) return false

    entry.command.execute()

    return true
  }

  function clearHistory(): void {
    history.value = []
    historyPointer.value = -1
    saveSession() // Trigger immediate save to clear DB
  }

  function jumpTo(index: number): void {
    if (index < -1 || index >= history.value.length) return

    // Undo or redo to reach the target state
    while (historyPointer.value > index) {
      undo()
    }
    while (historyPointer.value < index) {
      redo()
    }
  }

  return {
    canUndo,
    canRedo,
    undoName,
    redoName,
    historyList,
    execute,
    undo,
    redo,
    clearHistory,
    jumpTo,
    restoreHistory,
  }
}
