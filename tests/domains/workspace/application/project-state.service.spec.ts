import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectMeta } from '@/shared/infrastructure/db'
import { createProjectStateController } from '@/domains/workspace/application/project-state.service'
import type { DocumentUiState } from '@/shared/types/ui'

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

describe('project-state.service', () => {
  it('manages active and last-active project state via lifecycle adapter', () => {
    const lastActiveProjectId = ref<string | null>(null)
    const controller = createProjectStateController(lastActiveProjectId)
    const meta = createProjectMeta({ id: 'project-1' })

    controller.lifecycleState.setActiveProject('project-1', meta)
    controller.lifecycleState.setLastActiveProjectId('project-1')

    expect(controller.activeProjectId.value).toBe('project-1')
    expect(controller.activeProjectMeta.value).toEqual(meta)
    expect(controller.getLastActiveProjectId()).toBe('project-1')
    expect(controller.lifecycleState.getActiveProjectId()).toBe('project-1')
    expect(controller.lifecycleState.getActiveProjectMeta()).toEqual(meta)
  })

  it('proxies loading state to bound ui state when available', () => {
    const lastActiveProjectId = ref<string | null>(null)
    const controller = createProjectStateController(lastActiveProjectId)
    const setLoading = vi.fn()
    const uiState: DocumentUiState = {
      zoom: ref(120),
      setZoom: vi.fn(),
      setLoading,
      ignoredPreflightRuleIds: ref<string[]>([]),
      setIgnoredPreflightRuleIds: vi.fn(),
    }

    controller.setLoading(true, 'before bind')
    expect(setLoading).not.toHaveBeenCalled()

    controller.bindUiState(uiState)
    controller.setLoading(true, 'loading')

    expect(controller.boundUiState.value).toBe(uiState)
    expect(setLoading).toHaveBeenCalledWith(true, 'loading')
  })

  it('tracks hydrating flag and supports direct setters', () => {
    const lastActiveProjectId = ref<string | null>('old')
    const controller = createProjectStateController(lastActiveProjectId)

    controller.setHydrating(true)
    controller.setLastActiveProjectId('new')
    controller.setActiveProject(null, null)

    expect(controller.isHydrating.value).toBe(true)
    expect(controller.lastActiveProjectId.value).toBe('new')
    expect(controller.activeProjectId.value).toBeNull()
    expect(controller.activeProjectMeta.value).toBeNull()
  })
})
