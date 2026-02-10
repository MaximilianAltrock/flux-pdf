import { createRouter, createWebHistory } from 'vue-router'
import { db } from '@/db/db'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import DashboardView from '@/views/DashboardView.vue'
import EditorView from '@/views/EditorView.vue'
import SettingsView from '@/views/SettingsView.vue'
import TrashView from '@/views/TrashView.vue'
import WorkflowsView from '@/views/WorkflowsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DashboardLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView,
        },
        {
          path: 'trash',
          alias: 'bin',
          name: 'dashboard-trash',
          component: TrashView,
        },
        {
          path: 'workflows',
          name: 'dashboard-workflows',
          component: WorkflowsView,
        },
        {
          path: 'settings',
          name: 'dashboard-settings',
          component: SettingsView,
        },
      ],
    },
    {
      path: '/project/:id',
      name: 'project',
      component: EditorView,
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
