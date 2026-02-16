import { createRouter, createWebHistory } from 'vue-router'
import { db } from '@/shared/infrastructure/db'
import {
  isAccessibleProject,
  normalizeProjectIdParam,
} from '@/domains/workspace/application/router-guards'
import { STORAGE_KEYS } from '@/shared/constants'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/domains/workspace/ui/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/domains/workspace/ui/views/DashboardView.vue'),
        },
        {
          path: 'trash',
          name: 'dashboard-trash',
          component: () => import('@/domains/workspace/ui/views/TrashView.vue'),
        },
        {
          path: 'workflows',
          name: 'dashboard-workflows',
          component: () => import('@/domains/workspace/ui/views/WorkflowsView.vue'),
        },
        {
          path: 'settings',
          name: 'dashboard-settings',
          component: () => import('@/domains/workspace/ui/views/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/project/:id',
      name: 'project',
      component: () => import('@/domains/editor/ui/views/EditorView.vue'),
      props: true,
    },
  ],
})
let didBootRedirect = false

function getLastActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_PROJECT_ID)
}

function clearLastActiveProjectId() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE_PROJECT_ID)
}

async function getProjectById(id: string) {
  try {
    return await db.projects.get(id)
  } catch (error) {
    console.error(`Failed to lookup project "${id}" in route guard:`, error)
    return undefined
  }
}

router.beforeEach(async (to) => {
  try {
    if (to.name === 'dashboard') {
      if (!didBootRedirect) {
        didBootRedirect = true
        const lastId = getLastActiveProjectId()
        if (lastId) {
          const project = await getProjectById(lastId)
          if (isAccessibleProject(project)) {
            return { name: 'project', params: { id: lastId } }
          }
          clearLastActiveProjectId()
        }
      }
    }

    if (to.name === 'project') {
      const projectId = normalizeProjectIdParam(to.params.id)
      if (!projectId) return { name: 'dashboard' }

      const project = await getProjectById(projectId)
      if (!isAccessibleProject(project)) {
        const lastActiveProjectId = getLastActiveProjectId()
        if (lastActiveProjectId === projectId) {
          clearLastActiveProjectId()
        }
        return { name: 'dashboard' }
      }
    }

    return true
  } catch (error) {
    console.error('Router guard failed:', error)
    return true
  }
})

export default router
