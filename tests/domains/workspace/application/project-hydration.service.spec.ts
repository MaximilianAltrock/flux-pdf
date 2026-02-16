import { describe, expect, it, vi } from 'vitest'
import type { ProjectMeta, ProjectState, StoredFile } from '@/shared/infrastructure/db'
import { hydrateProjectWorkspace } from '@/domains/workspace/application/project-hydration.service'
import type { PageEntry, SourceFile } from '@/shared/types'

function createProjectMeta(partial: Partial<ProjectMeta>): ProjectMeta {
  return {
    id: partial.id ?? crypto.randomUUID(),
    title: partial.title ?? 'Project',
    pageCount: partial.pageCount ?? 0,
    updatedAt: partial.updatedAt ?? Date.now(),
    createdAt: partial.createdAt ?? Date.now(),
    trashedAt: partial.trashedAt,
    thumbnail: partial.thumbnail,
  }
}

function createProjectState(partial: Partial<ProjectState>): ProjectState {
  return {
    id: partial.id ?? crypto.randomUUID(),
    activeSourceIds: partial.activeSourceIds ?? [],
    pageMap: partial.pageMap ?? [],
    history: partial.history ?? [],
    historyPointer: partial.historyPointer ?? -1,
    zoom: partial.zoom ?? 220,
    updatedAt: partial.updatedAt ?? Date.now(),
    outlineTree: partial.outlineTree,
    outlineDirty: partial.outlineDirty,
    metadata: partial.metadata,
    security: partial.security,
    metadataDirty: partial.metadataDirty,
    ignoredPreflightRuleIds: partial.ignoredPreflightRuleIds,
  }
}

function createStoredFile(partial: Partial<StoredFile>): StoredFile {
  return {
    id: partial.id ?? crypto.randomUUID(),
    data: partial.data ?? new Uint8Array([1, 2, 3]).buffer,
    filename: partial.filename ?? 'source.pdf',
    fileSize: partial.fileSize ?? 3,
    pageCount: partial.pageCount ?? 1,
    addedAt: partial.addedAt ?? Date.now(),
    color: partial.color ?? 'blue',
    pageMetaData: partial.pageMetaData ?? [],
    isImageSource: partial.isImageSource,
    outline: partial.outline,
    metadata: partial.metadata,
  }
}

describe('project-hydration.service', () => {
  it('hydrates using persisted outline and metadata values', () => {
    const meta = createProjectMeta({ title: 'Hydrated Project' })
    const state = createProjectState({
      zoom: 250,
      pageMap: [{ id: 'p1', sourceFileId: 's1', sourcePageIndex: 0, rotation: 0 }],
      metadata: { title: 'Doc', author: 'Alice', subject: '', keywords: [] },
      metadataDirty: true,
      outlineTree: [
        {
          id: 'persisted',
          parentId: null,
          title: 'Persisted',
          expanded: true,
          dest: { type: 'none' },
          children: [],
        },
      ],
      outlineDirty: true,
      ignoredPreflightRuleIds: ['rule-1'],
      history: [{ type: 'Test', payload: { id: 'c1' }, timestamp: 123 }],
      historyPointer: 0,
      updatedAt: 999,
    })
    const files = [createStoredFile({ id: 's1', filename: 'source.pdf' })]

    const sources = new Map<string, SourceFile>()
    let pages: PageEntry[] = []
    const reset = vi.fn(() => {
      sources.clear()
      pages = []
    })
    const setOutlineTree = vi.fn()
    const setMetadata = vi.fn()
    const setMetadataDirty = vi.fn()
    const setSecurity = vi.fn()
    const setProjectTitle = vi.fn()
    const setOutlineDirty = vi.fn()
    const setPages = vi.fn((next: PageEntry[]) => {
      pages = [...next]
    })
    const addSourceFile = vi.fn((file: SourceFile) => {
      sources.set(file.id, file)
    })

    const historyStore = {
      clearHistory: vi.fn(),
      rehydrateHistory: vi.fn(),
    }
    const uiState = {
      setZoom: vi.fn(),
      setIgnoredPreflightRuleIds: vi.fn(),
    }

    const documentStore = {
      reset,
      addSourceFile,
      setProjectTitle,
      setOutlineDirty,
      setPages,
      setMetadata,
      setMetadataDirty,
      setSecurity,
      setOutlineTree,
      get contentPages() {
        return pages.filter((entry): entry is Exclude<PageEntry, { isDivider: true }> => !entry.isDivider)
      },
      sources,
    }

    hydrateProjectWorkspace({
      meta,
      state,
      files,
      documentStore,
      historyStore,
      uiState,
      defaultGridZoom: 220,
      clearThumbnailCache: vi.fn(),
    })

    expect(reset).toHaveBeenCalledOnce()
    expect(addSourceFile).toHaveBeenCalledOnce()
    expect(setProjectTitle).toHaveBeenCalledWith('Hydrated Project')
    expect(uiState.setZoom).toHaveBeenCalledWith(250)
    expect(uiState.setIgnoredPreflightRuleIds).toHaveBeenCalledWith(['rule-1'])
    expect(setMetadata).toHaveBeenCalledWith(state.metadata, false)
    expect(setMetadataDirty).toHaveBeenCalledWith(true)
    expect(setOutlineTree).toHaveBeenCalled()
    expect(setOutlineTree.mock.calls[0]?.[0]?.[0]?.id).toBe('persisted')
    expect(historyStore.clearHistory).toHaveBeenCalledOnce()
    expect(historyStore.rehydrateHistory).toHaveBeenCalledWith(state.history, 0, 999)
  })

  it('uses defaults for zoom/metadata dirty and auto-generates outline when needed', () => {
    const meta = createProjectMeta({ title: 'Auto Outline Project' })
    const state = createProjectState({
      zoom: undefined,
      pageMap: [{ id: 'p1', sourceFileId: 's1', sourcePageIndex: 0, rotation: 0 }],
      metadata: { title: 'Untitled Project', author: '', subject: '', keywords: [] },
      metadataDirty: undefined,
      outlineTree: [],
      outlineDirty: false,
    })
    const files = [createStoredFile({ id: 's1', filename: 'source.pdf' })]

    const sources = new Map<string, SourceFile>()
    let pages: PageEntry[] = []
    const setMetadataDirty = vi.fn()
    const setOutlineTree = vi.fn()

    const documentStore = {
      reset: vi.fn(),
      addSourceFile: vi.fn((file: SourceFile) => {
        sources.set(file.id, file)
      }),
      setProjectTitle: vi.fn(),
      setOutlineDirty: vi.fn(),
      setPages: vi.fn((next: PageEntry[]) => {
        pages = [...next]
      }),
      setMetadata: vi.fn(),
      setMetadataDirty,
      setSecurity: vi.fn(),
      setOutlineTree,
      get contentPages() {
        return pages.filter((entry): entry is Exclude<PageEntry, { isDivider: true }> => !entry.isDivider)
      },
      sources,
    }

    const uiState = {
      setZoom: vi.fn(),
      setIgnoredPreflightRuleIds: vi.fn(),
    }
    const historyStore = {
      clearHistory: vi.fn(),
      rehydrateHistory: vi.fn(),
    }

    hydrateProjectWorkspace({
      meta,
      state,
      files,
      documentStore,
      historyStore,
      uiState,
      defaultGridZoom: 220,
      clearThumbnailCache: vi.fn(),
    })

    expect(uiState.setZoom).toHaveBeenCalledWith(220)
    expect(setMetadataDirty).toHaveBeenCalledWith(false)
    expect(setOutlineTree).toHaveBeenCalled()
    expect(setOutlineTree.mock.calls[0]?.[0]?.[0]?.title).toBe('source')
  })
})
