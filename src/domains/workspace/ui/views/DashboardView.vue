<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { liveQuery } from 'dexie'
import { useRouter } from 'vue-router'
import { DEFAULT_PROJECT_TITLE } from '@/shared/constants'
import { useProjectThumbnailUrls } from '@/domains/workspace/application'
import { useWorkspaceCatalogStore } from '@/domains/workspace/store'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useToast } from '@/shared/composables/useToast'
import type { ProjectMeta } from '@/shared/infrastructure/db'
import DashboardHeaderBar from '@/domains/workspace/ui/components/dashboard/DashboardHeaderBar.vue'
import DashboardProjectsPanel from '@/domains/workspace/ui/components/dashboard/DashboardProjectsPanel.vue'

const PROJECT_LIST_LIMIT = 50
const sortOptions = [
  { value: 'updated', label: 'Last Modified' },
  { value: 'created', label: 'Date Created' },
  { value: 'title', label: 'Alphabetical' },
] as const
type SortKey = (typeof sortOptions)[number]['value']

const router = useRouter()
const projectsStore = useWorkspaceCatalogStore()
const { confirm } = useConfirm()
const toast = useToast()

const projects = ref<ProjectMeta[]>([])
const isLoading = shallowRef(true)
const query = shallowRef('')
const sort = shallowRef<SortKey>('updated')
const editingId = shallowRef<string | null>(null)
let projectFeed: { unsubscribe(): void } | null = null

const searchTerm = computed(() => query.value.trim().toLowerCase())
const isSearchActive = computed(() => searchTerm.value.length > 0)
const { thumbnailUrlById } = useProjectThumbnailUrls(projects)

const sortComparators: Record<SortKey, (a: ProjectMeta, b: ProjectMeta) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  title: (a, b) => a.title.localeCompare(b.title),
}

async function refreshProjects() {
  // Don't set loading true if we already have data (prevents flashing on soft refresh)
  if (projects.value.length === 0) isLoading.value = true

  try {
    // Artificial delay removed, logic stays same
    projects.value = await projectsStore.listRecentProjects(PROJECT_LIST_LIMIT)
  } catch (error) {
    console.error('Failed to load projects:', error)
  } finally {
    isLoading.value = false
  }
}

function startProjectFeed() {
  projectFeed?.unsubscribe()
  projectFeed = liveQuery(() => projectsStore.listRecentProjects(PROJECT_LIST_LIMIT)).subscribe({
    next: (nextProjects) => {
      projects.value = nextProjects
      isLoading.value = false
    },
    error: (error) => {
      console.error('Failed to subscribe to recent projects:', error)
      void refreshProjects()
    },
  })
}

onMounted(() => {
  startProjectFeed()
  void refreshProjects()
})

onBeforeUnmount(() => {
  projectFeed?.unsubscribe()
  projectFeed = null
})

const handleRenameCancel = () => {
  editingId.value = null
}

const filteredProjects = computed(() => {
  const term = searchTerm.value
  const list = term
    ? projects.value.filter((project) => project.title.toLowerCase().includes(term))
    : projects.value
  return [...list].sort(sortComparators[sort.value])
})

async function handleOpenProject(id: string) {
  await router.push(`/project/${id}`)
}

async function handleCreateProject() {
  const meta = await projectsStore.createProject({ title: DEFAULT_PROJECT_TITLE })
  await router.push(`/project/${meta.id}`)
}

async function handleDuplicate(project: ProjectMeta) {
  const created = await projectsStore.duplicateProject(project.id)
  if (created) {
    toast.success('Project duplicated')
    await refreshProjects()
  }
}

async function handleDelete(project: ProjectMeta) {
  const confirmed = await confirm({
    title: `Move "${project.title}" to trash?`,
    message: 'You can restore this project later from Trash.',
    confirmText: 'Move to Trash',
    variant: 'warning',
  })
  if (!confirmed) return
  await projectsStore.trashProject(project.id)
  toast.success('Project moved to trash')
  await refreshProjects()
}

function handleRenameStart(project: ProjectMeta) {
  editingId.value = project.id
}

async function handleRenameCommit(project: ProjectMeta, nextTitle: string) {
  if (editingId.value !== project.id) return
  editingId.value = null
  const trimmed = nextTitle.trim()
  if (!trimmed || trimmed === project.title) return
  await projectsStore.renameProject(project.id, trimmed)
  await refreshProjects()
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <DashboardHeaderBar v-model:query="query" @create="handleCreateProject" />

    <DashboardProjectsPanel
      :is-loading="isLoading"
      :is-search-active="isSearchActive"
      :filtered-projects="filteredProjects"
      :sort-options="sortOptions"
      v-model:sort="sort"
      :editing-id="editingId"
      :thumbnail-url-by-id="thumbnailUrlById"
      @create="handleCreateProject"
      @open="handleOpenProject"
      @rename-start="handleRenameStart"
      @rename-commit="handleRenameCommit"
      @rename-cancel="handleRenameCancel"
      @duplicate="handleDuplicate"
      @delete="handleDelete"
    />
  </section>
</template>
