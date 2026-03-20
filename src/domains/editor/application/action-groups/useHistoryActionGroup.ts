import { toRef } from 'vue'
import type { HistorySession } from '@/domains/history/session/create-history-session'

export function useHistoryActionGroup(history: HistorySession) {
  return {
    undo: history.undo,
    redo: history.redo,
    clearHistory: history.clearHistory,
    jumpTo: history.jumpTo,
    canUndo: toRef(history, 'canUndo'),
    canRedo: toRef(history, 'canRedo'),
    undoName: toRef(history, 'undoName'),
    redoName: toRef(history, 'redoName'),
    historyList: toRef(history, 'historyList'),
  }
}
