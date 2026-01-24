import { createRouter, createWebHistory } from 'vue-router'
import { db } from '@/db/db'
import DashboardView from '@/views/DashboardView.vue'
import EditorView from '@/views/EditorView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
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
        const exists = await db.projects.get(lastId)
        if (exists) {
          return { name: 'project', params: { id: lastId } }
        }
        window.localStorage.removeItem('lastActiveProjectId')
      }
    }
  }

  if (to.name === 'project') {
    const id = String(to.params.id ?? '')
    if (!id) return { name: 'dashboard' }
    const exists = await db.projects.get(id)
    if (!exists) {
      return { name: 'dashboard' }
    }
  }

  return true
})

export default router
