import { ref, computed } from 'vue'
import { HISTORY } from '@/constants'
import { useDocumentStore } from '@/stores/document'
import { commandRegistry } from '@/commands'
import { type Command, type HistoryEntry, type HistoryDisplayEntry, type SerializedCommand } from '@/commands'

/**
 * Global command history state (singleton)
 * Defined outside to persist across component mounts
 */
const history = ref<HistoryEntry[]>([])
const historyPointer = ref<number>(HISTORY.POINTER_START)
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
  // Serialization Helpers
  // ============================================

  function serializeHistory(): SerializedCommand[] {
    const toPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value))
    return history.value.map((entry) => toPlain(entry.command.serialize()))
  }

  function getHistoryPointer(): number {
    return historyPointer.value
  }

  function rehydrateHistory(
    serializedHistory: SerializedCommand[] = [],
    pointer: number = HISTORY.POINTER_START,
    updatedAt?: number,
  ): void {
    sessionStartTime.value = updatedAt || Date.now()

    const rehydratedEntries: HistoryEntry[] = []

    for (const serialized of serializedHistory) {
      const command = commandRegistry.deserialize(serialized)

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

    const clampedPointer = Math.max(
      HISTORY.POINTER_START,
      Math.min(pointer ?? HISTORY.POINTER_START, rehydratedEntries.length - 1),
    )
    historyPointer.value = clampedPointer

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
        return {
          type: 'Root',
          payload: { id: 'root' },
          timestamp: sessionStartTime.value,
        }
      },
    }

    const rootEntry: HistoryDisplayEntry = {
      command: rootCommand,
      timestamp: sessionStartTime.value,
      isCurrent: historyPointer.value === HISTORY.POINTER_START,
      isUndone: historyPointer.value < HISTORY.POINTER_START, // Never undone
      pointer: HISTORY.POINTER_START,
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
    if (history.value.length > HISTORY.MAX_ENTRIES) {
      history.value = history.value.slice(-HISTORY.MAX_ENTRIES)
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
    historyPointer.value = HISTORY.POINTER_START
  }

  /**
   * Jump to a specific point in history
   * @param index - Target history index
   */
  function jumpTo(index: number): void {
    if (index < HISTORY.POINTER_START || index >= history.value.length) return

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
    serializeHistory,
    rehydrateHistory,
    getHistoryPointer,
  }
}
