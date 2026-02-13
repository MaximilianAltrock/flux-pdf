import { createRouter, createWebHistory } from 'vue-router'
import { db } from '@/db/db'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'trash',
          name: 'dashboard-trash',
          component: () => import('@/views/TrashView.vue'),
        },
        {
          path: 'workflows',
          name: 'dashboard-workflows',
          component: () => import('@/views/WorkflowsView.vue'),
        },
        {
          path: 'settings',
          name: 'dashboard-settings',
          component: () => import('@/views/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/project/:id',
      name: 'project',
      component: () => import('@/views/EditorView.vue'),
      props: true,
    },
  ],
})
let didBootRedirect = false

function getLastActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('lastActiveProjectId')
}

router.beforeEach(async (to) => {
  if (to.name === 'dashboard') {
    if (!didBootRedirect) {
      didBootRedirect = true
      const lastId = getLastActiveProjectId()
      if (lastId) {
        const project = await db.projects.get(lastId)
        if (project && !project.trashedAt) {
          return { name: 'project', params: { id: lastId } }
        }
        window.localStorage.removeItem('lastActiveProjectId')
      }
    }
  }

  if (to.name === 'project') {
    const id = String(to.params.id ?? '')
    if (!id) return { name: 'dashboard' }
    const project = await db.projects.get(id)
    if (!project || project.trashedAt) {
      return { name: 'dashboard' }
    }
  }

  return true
})

export default router
