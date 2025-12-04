import { ref, computed } from 'vue'
import type { Command, HistoryEntry } from '@/commands/types'

/**
 * Maximum number of commands to keep in history
 */
const MAX_HISTORY_SIZE = 50

/**
 * Global command history state (singleton)
 */
const history = ref<HistoryEntry[]>([])
const historyPointer = ref(-1)

/**
 * Composable for managing command execution with undo/redo support
 */
export function useCommandManager() {
  /**
   * Whether undo is available
   */
  const canUndo = computed(() => historyPointer.value >= 0)
  
  /**
   * Whether redo is available
   */
  const canRedo = computed(() => historyPointer.value < history.value.length - 1)
  
  /**
   * Get the name of the command that would be undone
   */
  const undoName = computed(() => {
    if (!canUndo.value) return null
    return history.value[historyPointer.value]?.command.name ?? null
  })
  
  /**
   * Get the name of the command that would be redone
   */
  const redoName = computed(() => {
    if (!canRedo.value) return null
    return history.value[historyPointer.value + 1]?.command.name ?? null
  })
  
  /**
   * Get the full history for display
   */
  const historyList = computed(() => history.value.map((entry, index) => ({
    ...entry,
    isCurrent: index === historyPointer.value,
    isUndone: index > historyPointer.value
  })))

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
      timestamp: Date.now()
    })
    
    // Trim history if too long
    if (history.value.length > MAX_HISTORY_SIZE) {
      history.value = history.value.slice(-MAX_HISTORY_SIZE)
    }
    
    // Move pointer to end
    historyPointer.value = history.value.length - 1
  }

  /**
   * Undo the last command
   */
  function undo(): boolean {
    if (!canUndo.value) return false
    
    const entry = history.value[historyPointer.value]
    entry.command.undo()
    historyPointer.value--
    
    return true
  }

  /**
   * Redo the next command
   */
  function redo(): boolean {
    if (!canRedo.value) return false
    
    historyPointer.value++
    const entry = history.value[historyPointer.value]
    entry.command.execute()
    
    return true
  }

  /**
   * Clear all history
   */
  function clearHistory(): void {
    history.value = []
    historyPointer.value = -1
  }

  /**
   * Jump to a specific point in history
   */
  function jumpTo(index: number): void {
    if (index < -1 || index >= history.value.length) return
    
    // Undo or redo to reach the target
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
    jumpTo
  }
}
