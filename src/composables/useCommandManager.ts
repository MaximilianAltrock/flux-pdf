import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useDocumentStore } from '@/stores/document'
import { db, type SessionState } from '@/db/db'
import { commandRegistry } from '@/commands'
import type { Command, HistoryEntry, HistoryDisplayEntry, SerializedCommand } from '@/commands'

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
const sessionStartTime = ref(Date.now())

/**
 * Command Manager Composable
 *
 * Manages the undo/redo command history stack.
 * Persists history to IndexedDB for session restoration.
 */
export function useCommandManager() {
  const store = useDocumentStore()

  // ============================================
  // Persistence Logic (IndexedDB)
  // ============================================

  /**
   * Persist the current session state to IndexedDB.
   */
  async function persistSession(): Promise<void> {
    // Ensure we only persist plain JSON-friendly data (no Proxies)
    const toPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value))

    // Serialize history using the new command.serialize() method
    const serializedHistory: SerializedCommand[] = history.value.map((entry) =>
      toPlain(entry.command.serialize()),
    )

    // Construct session object
    const sessionData: SessionState = {
      id: 'current-session',
      projectTitle: String(store.projectTitle ?? ''),
      activeSourceIds: Array.from(store.sources.keys()),
      pageMap: toPlain(store.pages),
      history: serializedHistory,
      historyPointer: historyPointer.value,
      zoom: Number(store.zoom),
      updatedAt: Date.now(),
    }

    // Write to DB
    try {
      await db.session.put(sessionData)
    } catch (e) {
      console.error('Failed to save session to IndexedDB:', e)
    }
  }

  /**
   * Save the current session state to IndexedDB.
   * Debounced by 1s via VueUse to prevent database thrashing.
   */
  const saveSession = useDebounceFn(persistSession, 1000)

  /**
   * Watch for state changes to trigger auto-save
   */
  watch(
    [historyPointer, () => store.pages, () => store.projectTitle, () => store.zoom],
    () => {
      saveSession()
    },
    { deep: true },
  )

  /**
   * Restore the history stack from IndexedDB on app launch
   */
  async function restoreHistory(): Promise<void> {
    try {
      const session = await db.session.get('current-session')
      if (!session || !session.history) return

      sessionStartTime.value = session.updatedAt || Date.now()

      const rehydratedEntries: HistoryEntry[] = []

      for (const serialized of session.history) {
        // Use the new registry-based deserialization
        const command = commandRegistry.deserialize(serialized as SerializedCommand)

        if (command) {
          rehydratedEntries.push({
            command,
            timestamp: command.createdAt,
          })
        } else {
          console.warn(`Skipping unknown command type during restore: ${serialized.type}`)
        }
      }

      history.value = rehydratedEntries

      // Clamp pointer to available history in case some commands were skipped
      const clampedPointer = Math.max(
        -1,
        Math.min(session.historyPointer ?? -1, rehydratedEntries.length - 1),
      )
      historyPointer.value = clampedPointer

      // If the page map wasn't restored (e.g., failed persistence), rebuild state by replaying history
      if (store.pages.length === 0 && clampedPointer >= 0) {
        for (let i = 0; i <= clampedPointer; i++) {
          try {
            rehydratedEntries[i]?.command.execute()
          } catch (error) {
            console.error('Failed to replay command during restore:', error)
            break
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore history:', e)
    }
  }

  // ============================================
  // Computed Properties
  // ============================================

  const canUndo = computed(() => historyPointer.value >= 0)
  const canRedo = computed(() => historyPointer.value < history.value.length - 1)

  const undoName = computed((): string | null => {
    if (!canUndo.value) return null
    return history.value[historyPointer.value]?.command.name ?? null
  })

  const redoName = computed((): string | null => {
    if (!canRedo.value) return null
    return history.value[historyPointer.value + 1]?.command.name ?? null
  })

  const historyList = computed((): HistoryDisplayEntry[] => {
    // Create the "Root" entry
    const rootCommand: Command = {
      id: 'root',
      type: 'Root',
      name: 'Session Start',
      createdAt: sessionStartTime.value,
      execute() {},
      undo() {},
      serialize() {
        return { type: 'Root', payload: { id: 'root' }, timestamp: sessionStartTime.value }
      },
    }

    const rootEntry: HistoryDisplayEntry = {
      command: rootCommand,
      timestamp: sessionStartTime.value,
      isCurrent: historyPointer.value === -1,
      isUndone: historyPointer.value < -1, // Never undone
      pointer: -1,
    }

    const mapped = history.value.map((entry, index) => ({
      ...entry,
      isCurrent: index === historyPointer.value,
      isUndone: index > historyPointer.value,
      pointer: index,
    }))

    return [rootEntry, ...mapped]
  })

  // ============================================
  // Command Operations
  // ============================================

  /**
   * Execute a command and add it to history
   */
  function execute(command: Command): void {
    // If we're in the middle of history, discard the "future"
    if (historyPointer.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyPointer.value + 1)
    }

    // Execute the command
    command.execute()

    // Add to history
    history.value.push({
      command,
      timestamp: command.createdAt,
    })

    // Trim history if too long
    if (history.value.length > MAX_HISTORY_SIZE) {
      history.value = history.value.slice(-MAX_HISTORY_SIZE)
    }

    historyPointer.value = history.value.length - 1
  }

  /**
   * Undo the last command
   * @returns true if undo was performed
   */
  function undo(): boolean {
    if (!canUndo.value) return false

    const entry = history.value[historyPointer.value]
    if (!entry) return false

    entry.command.undo()
    historyPointer.value--

    return true
  }

  /**
   * Redo the next command
   * @returns true if redo was performed
   */
  function redo(): boolean {
    if (!canRedo.value) return false

    historyPointer.value++
    const entry = history.value[historyPointer.value]
    if (!entry) return false

    entry.command.execute()

    return true
  }

  /**
   * Clear all history
   */
  function clearHistory(): void {
    history.value = []
    historyPointer.value = -1
    void persistSession() // Clear persisted history immediately
  }

  /**
   * Jump to a specific point in history
   * @param index - Target history index
   */
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
    // State
    canUndo,
    canRedo,
    undoName,
    redoName,
    historyList,

    // Actions
    execute,
    undo,
    redo,
    clearHistory,
    jumpTo,
    restoreHistory,
  }
}
