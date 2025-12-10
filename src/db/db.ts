import Dexie, { type Table } from 'dexie'
import type { PageReference } from '@/types'

// Serialization interface for Commands
export interface SerializedCommand {
  type: string
  payload: any
  timestamp: number
}

// 1. The "Session" Table (The current workspace state)
export interface SessionState {
  id: 'current-session' // Singleton ID
  projectTitle: string
  pageMap: PageReference[]
  history: SerializedCommand[]
  historyPointer: number
  zoom: number
  updatedAt: number
}

// 2. The "Files" Table (Heavy Blobs)
export interface StoredFile {
  id: string
  data: ArrayBuffer // The heavy PDF binary
  filename: string
  fileSize: number
  pageCount: number
  addedAt: number
  color: string
}

export class FluxDatabase extends Dexie {
  session!: Table<SessionState>
  files!: Table<StoredFile>

  constructor() {
    super('FluxPDF_DB')

    this.version(1).stores({
      session: 'id', // Singleton
      files: 'id', // Source File ID
    })
  }
}

export const db = new FluxDatabase()
