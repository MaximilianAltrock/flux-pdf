import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { HISTORY } from '@/shared/constants'
import { useDocumentStore } from '@/domains/document/store/document.store'
import { createHistoryCommandExecutor } from '@/domains/history/application'
import { BatchCommand, commandRegistry } from '@/domains/history/domain/commands'
import type {
  Command,
  HistoryEntry,
  HistoryDisplayEntry,
  SerializedCommand,
} from '@/domains/history/domain/commands'
import { createLogger } from '@/shared/infrastructure/logger'
import { toJsonSafeSerializedCommand } from '@/domains/history/domain/commands/serialization'

/**
 * Command History Store
 *
 * Manages the undo/redo command history stack.
 * Persists history to IndexedDB for session restoration.
 */
export const useHistoryStore = defineStore('history', () => {
  const log = createLogger('history-store')
  const store = useDocumentStore()
  const commandExecutor = createHistoryCommandExecutor({
    documentStore: store,
    logger: log,
  })

  // ============================================
  // State
  // ============================================
  const history = ref<HistoryEntry[]>([])
  const historyPointer = shallowRef<number>(HISTORY.POINTER_START)
  const sessionStartTime = shallowRef<number>(Date.now())

  // ============================================
  // Serialization Helpers
  // ============================================
  function serializeHistory(): SerializedCommand[] {
    return history.value.map((entry) => toJsonSafeSerializedCommand(entry.command.serialize()))
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
      let normalized: SerializedCommand
      try {
        normalized = toJsonSafeSerializedCommand(serialized)
      } catch (error) {
        log.warn('Skipping invalid serialized command during restore:', error)
        continue
      }

      const command = commandRegistry.deserialize(normalized)

      if (command) {
        rehydratedEntries.push({
          command,
          timestamp: command.createdAt,
        })
      } else {
        log.warn(`Skipping unknown command type during restore: ${serialized.type}`)
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
          const command = rehydratedEntries[i]?.command
          if (!command) continue
          commandExecutor.execute(command)
        } catch (error) {
          log.error('Failed to replay command during restore:', error)
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
    return history.value[historyPointer.value]?.command.label ?? null
  })

  const redoName = computed((): string | null => {
    if (!canRedo.value) return null
    return history.value[historyPointer.value + 1]?.command.label ?? null
  })

  const historyList = computed((): HistoryDisplayEntry[] => {
    // Create the "Root" entry
    const rootCommand: Command = {
      id: 'root',
      type: 'Root',
      name: 'Session Start',
      label: 'Session Start',
      createdAt: sessionStartTime.value,
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
      isUndone: historyPointer.value < HISTORY.POINTER_START,
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

  function execute(command: Command): void {
    if (historyPointer.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyPointer.value + 1)
    }

    commandExecutor.execute(command)

    history.value.push({
      command,
      timestamp: command.createdAt,
    })

    if (history.value.length > HISTORY.MAX_ENTRIES) {
      history.value = history.value.slice(-HISTORY.MAX_ENTRIES)
    }

    historyPointer.value = history.value.length - 1
  }

  function executeBatch(commands: readonly Command[], label?: string): Command | null {
    const validCommands = commands.filter((command): command is Command => Boolean(command))
    if (validCommands.length === 0) return null

    if (validCommands.length === 1) {
      const first = validCommands[0]
      if (!first) return null
      execute(first)
      return first
    }

    const batch = new BatchCommand([...validCommands], label)
    execute(batch)
    return batch
  }

  function undo(): boolean {
    if (!canUndo.value) return false

    const entry = history.value[historyPointer.value]
    if (!entry) return false

    commandExecutor.undo(entry.command)
    historyPointer.value--

    return true
  }

  function redo(): boolean {
    if (!canRedo.value) return false

    historyPointer.value++
    const entry = history.value[historyPointer.value]
    if (!entry) return false

    commandExecutor.execute(entry.command)

    return true
  }

  function clearHistory(): void {
    history.value = []
    historyPointer.value = HISTORY.POINTER_START
  }

  function jumpTo(index: number): void {
    if (index < HISTORY.POINTER_START || index >= history.value.length) return

    while (historyPointer.value > index) {
      undo()
    }
    while (historyPointer.value < index) {
      redo()
    }
  }

  return {
    // State
    history,
    historyPointer,
    sessionStartTime,

    // Computed
    canUndo,
    canRedo,
    undoName,
    redoName,
    historyList,

    // Actions
    execute,
    executeBatch,
    undo,
    redo,
    clearHistory,
    jumpTo,
    serializeHistory,
    rehydrateHistory,
    getHistoryPointer,
  }
})
