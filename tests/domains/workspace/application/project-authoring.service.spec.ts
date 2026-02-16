import { describe, expect, it, vi } from 'vitest'
import type { ProjectMeta, ProjectState } from '@/shared/infrastructure/db'
import { createProjectAuthoringService } from '@/domains/workspace/application/project-authoring.service'
import type { PageReference } from '@/shared/types'

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

function createPageReference(partial: Partial<PageReference>): PageReference {
  return {
    id: partial.id ?? crypto.randomUUID(),
    sourceFileId: partial.sourceFileId ?? 'source-1',
    sourcePageIndex: partial.sourcePageIndex ?? 0,
    rotation: partial.rotation ?? 0,
    groupId: partial.groupId,
    targetDimensions: partial.targetDimensions,
    redactions: partial.redactions,
  }
}

describe('project-authoring.service', () => {
  it('creates a new project record with normalized metadata defaults', async () => {
    const metas = new Map<string, ProjectMeta>()
    const states = new Map<string, ProjectState>()
    const service = createProjectAuthoringService({
      loadProjectMeta: async (id) => metas.get(id),
      saveProjectRecord: async (meta, state) => {
        metas.set(meta.id, meta)
        states.set(state.id, state)
      },
    })

    const meta = await service.createProject({
      title: '   ',
      defaultAuthor: '  Alice  ',
      defaultGridZoom: 180,
      now: 123,
      projectId: 'project-1',
    })

    const state = states.get('project-1')
    expect(meta).toEqual(
      createProjectMeta({
        id: 'project-1',
        title: 'Untitled Project',
        pageCount: 0,
        updatedAt: 123,
        createdAt: 123,
        trashedAt: null,
      }),
    )
    expect(state?.zoom).toBe(180)
    expect(state?.metadata).toEqual({
      title: 'Untitled Project',
      author: 'Alice',
      subject: '',
      keywords: [],
    })
  })

  it('persists active project snapshot and returns updated meta', async () => {
    const metas = new Map<string, ProjectMeta>([
      [
        'project-1',
        createProjectMeta({
          id: 'project-1',
          title: 'Old',
          pageCount: 1,
          createdAt: 10,
          updatedAt: 10,
        }),
      ],
    ])
    const states = new Map<string, ProjectState>([
      ['project-1', createProjectState({ id: 'project-1', updatedAt: 10 })],
    ])
    const saveProjectRecord = vi.fn(async (meta: ProjectMeta, state: ProjectState) => {
      metas.set(meta.id, meta)
      states.set(state.id, state)
    })
    const service = createProjectAuthoringService({
      loadProjectMeta: async (id) => metas.get(id),
      saveProjectRecord,
    })
    const firstPage = createPageReference({ id: 'page-1' })
    const ensureThumbnail = vi.fn(async () => new Blob(['thumb']))

    const meta = await service.persistProject({
      projectId: 'project-1',
      existingMeta: null,
      projectTitle: '  New Title  ',
      contentPages: [firstPage],
      contentPageCount: 3,
      snapshot: {
        activeSourceIds: ['source-1'],
        pageMap: [firstPage],
        history: [],
        historyPointer: 0,
        zoom: 210,
        outlineTree: [],
        outlineDirty: false,
        metadata: {
          title: 'Doc',
          author: 'Alice',
          subject: '',
          keywords: [],
        },
        security: undefined,
        metadataDirty: true,
        ignoredPreflightRuleIds: ['rule-1'],
      },
      ensureThumbnail,
      now: 999,
    })

    expect(meta?.id).toBe('project-1')
    expect(meta?.title).toBe('New Title')
    expect(meta?.pageCount).toBe(3)
    expect(meta?.updatedAt).toBe(999)
    expect(meta?.thumbnail).toBeInstanceOf(Blob)
    expect(ensureThumbnail).toHaveBeenCalledTimes(1)
    expect(saveProjectRecord).toHaveBeenCalledTimes(1)
    expect(states.get('project-1')?.historyPointer).toBe(0)
    expect(states.get('project-1')?.ignoredPreflightRuleIds).toEqual(['rule-1'])
  })

  it('returns null when persisting a project that has no stored meta', async () => {
    const saveProjectRecord = vi.fn(async () => {})
    const service = createProjectAuthoringService({
      loadProjectMeta: async () => undefined,
      saveProjectRecord,
    })

    const result = await service.persistProject({
      projectId: 'missing',
      existingMeta: null,
      projectTitle: 'Title',
      contentPages: [],
      contentPageCount: 0,
      snapshot: {
        activeSourceIds: [],
        pageMap: [],
        history: [],
        historyPointer: -1,
        zoom: 120,
        outlineTree: [],
        outlineDirty: false,
        metadata: {
          title: 'Untitled Project',
          author: '',
          subject: '',
          keywords: [],
        },
        security: undefined,
        metadataDirty: false,
        ignoredPreflightRuleIds: [],
      },
      ensureThumbnail: vi.fn(async () => undefined),
    })

    expect(result).toBeNull()
    expect(saveProjectRecord).not.toHaveBeenCalled()
  })
})
