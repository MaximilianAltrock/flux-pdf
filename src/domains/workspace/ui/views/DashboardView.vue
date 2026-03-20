<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { DEFAULT_PROJECT_TITLE } from '@/shared/constants'
import {
  useLiveProjectList,
  useProjectCatalog,
  useProjectThumbnailUrls,
} from '@/domains/workspace/application'
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
const projectCatalog = useProjectCatalog()
const { confirm } = useConfirm()
const toast = useToast()

const query = shallowRef('')
const sort = shallowRef<SortKey>('updated')
const editingId = shallowRef<string | null>(null)
const { items: projects, isLoading } = useLiveProjectList(
  () => projectCatalog.listRecentProjects(PROJECT_LIST_LIMIT),
  {
    onError: (error) => {
      console.error('Failed to subscribe to recent projects:', error)
    },
  },
)

const searchTerm = computed(() => query.value.trim().toLowerCase())
const isSearchActive = computed(() => searchTerm.value.length > 0)
const { thumbnailUrlById } = useProjectThumbnailUrls(projects)

const sortComparators: Record<SortKey, (a: ProjectMeta, b: ProjectMeta) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  title: (a, b) => a.title.localeCompare(b.title),
}

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
  const meta = await projectCatalog.createProject({ title: DEFAULT_PROJECT_TITLE })
  await router.push(`/project/${meta.id}`)
}

async function handleDuplicate(project: ProjectMeta) {
  const created = await projectCatalog.duplicateProject(project.id)
  if (created) {
    toast.success('Project duplicated')
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
  await projectCatalog.trashProject(project.id)
  toast.success('Project moved to trash')
}

function handleRenameStart(project: ProjectMeta) {
  editingId.value = project.id
}

async function handleRenameCommit(project: ProjectMeta, nextTitle: string) {
  if (editingId.value !== project.id) return
  editingId.value = null
  const trimmed = nextTitle.trim()
  if (!trimmed || trimmed === project.title) return
  await projectCatalog.renameProject(project.id, trimmed)
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
