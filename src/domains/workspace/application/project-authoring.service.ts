import type { ProjectMeta, ProjectState } from '@/shared/infrastructure/db'
import { buildProjectState, type ProjectSnapshot } from '@/domains/document/domain/project'
import {
  buildDefaultProjectMetadata,
  buildInitialProjectSnapshot,
  buildPersistedProjectMeta,
  buildPersistedProjectSnapshot,
  getFirstContentPage,
  normalizeProjectTitle,
} from '@/domains/workspace/application/project-session.service'
import type { OutlineNode, PageReference } from '@/shared/types'

export interface ProjectAuthoringPersistence {
  loadProjectMeta(id: string): Promise<ProjectMeta | undefined>
  saveProjectRecord(meta: ProjectMeta, state: ProjectState): Promise<void>
}

export interface CreateProjectInput {
  title?: string
  defaultAuthor: string
  defaultGridZoom: number
  now?: number
  projectId?: string
}

export interface PersistProjectInput {
  projectId: string
  existingMeta?: ProjectMeta | null
  projectTitle: string
  contentPages: PageReference[]
  contentPageCount: number
  snapshot: {
    activeSourceIds: ProjectSnapshot['activeSourceIds']
    pageMap: ProjectSnapshot['pageMap']
    history: ProjectSnapshot['history']
    historyPointer: ProjectSnapshot['historyPointer']
    zoom: ProjectSnapshot['zoom']
    outlineTree: OutlineNode[]
    outlineDirty: NonNullable<ProjectSnapshot['outlineDirty']>
    metadata: NonNullable<ProjectSnapshot['metadata']>
    security: ProjectSnapshot['security']
    metadataDirty: NonNullable<ProjectSnapshot['metadataDirty']>
    ignoredPreflightRuleIds: NonNullable<ProjectSnapshot['ignoredPreflightRuleIds']>
  }
  ensureThumbnail(meta: ProjectMeta, page: PageReference | null): Promise<Blob | undefined>
  now?: number
}

function createProjectId(now = Date.now()): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `project-${now}`
}

export function createProjectAuthoringService(persistence: ProjectAuthoringPersistence) {
  async function createProject(input: CreateProjectInput): Promise<ProjectMeta> {
    const projectTitle = normalizeProjectTitle(input.title)
    const now = input.now ?? Date.now()
    const id = input.projectId ?? createProjectId(now)
    const meta: ProjectMeta = {
      id,
      title: projectTitle,
      pageCount: 0,
      updatedAt: now,
      createdAt: now,
      trashedAt: null,
    }

    const snapshot = buildInitialProjectSnapshot({
      zoom: input.defaultGridZoom,
      metadata: buildDefaultProjectMetadata({
        projectTitle,
        defaultAuthor: input.defaultAuthor,
      }),
    })

    const state = buildProjectState(id, snapshot)
    await persistence.saveProjectRecord(meta, state)
    return meta
  }

  async function persistProject(input: PersistProjectInput): Promise<ProjectMeta | null> {
    if (!input.projectId) return null

    const existingMeta = input.existingMeta ?? (await persistence.loadProjectMeta(input.projectId))
    if (!existingMeta) return null

    const now = input.now ?? Date.now()
    const title = normalizeProjectTitle(input.projectTitle)
    const firstPage = getFirstContentPage(input.contentPages)
    const thumbnail = await input.ensureThumbnail(existingMeta, firstPage)

    const meta: ProjectMeta = buildPersistedProjectMeta({
      existingMeta,
      title,
      pageCount: input.contentPageCount,
      now,
      thumbnail,
    })

    const snapshot = buildPersistedProjectSnapshot({
      activeSourceIds: input.snapshot.activeSourceIds,
      pageMap: input.snapshot.pageMap,
      history: input.snapshot.history,
      historyPointer: input.snapshot.historyPointer,
      zoom: input.snapshot.zoom,
      outlineTree: input.snapshot.outlineTree,
      outlineDirty: input.snapshot.outlineDirty,
      metadata: input.snapshot.metadata,
      security: input.snapshot.security,
      metadataDirty: input.snapshot.metadataDirty,
      ignoredPreflightRuleIds: input.snapshot.ignoredPreflightRuleIds,
    })

    const state = buildProjectState(input.projectId, snapshot)
    state.updatedAt = now

    await persistence.saveProjectRecord(meta, state)
    return meta
  }

  return {
    createProject,
    persistProject,
  }
}

