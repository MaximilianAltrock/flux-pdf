<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { DEFAULT_PROJECT_TITLE } from '@/shared/constants'
import { useProjectsStore } from '@/domains/workspace/store/projects.store'
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
const projectsStore = useProjectsStore()
const { confirm } = useConfirm()
const toast = useToast()

const projects = ref<ProjectMeta[]>([])
const isLoading = shallowRef(true)
const query = shallowRef('')
const sort = shallowRef<SortKey>('updated')
const editingId = shallowRef<string | null>(null)

const thumbnailUrls = new Map<string, string>()
const thumbnailBlobs = new Map<string, Blob | undefined>()

const searchTerm = computed(() => query.value.trim().toLowerCase())
const isSearchActive = computed(() => searchTerm.value.length > 0)

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

onMounted(refreshProjects)

const handleRenameCancel = () => {
  editingId.value = null
}

// Memory Management for Blob URLs
const revokeThumbnail = (projectId: string) => {
  const url = thumbnailUrls.get(projectId)
  if (url) URL.revokeObjectURL(url)
  thumbnailUrls.delete(projectId)
  thumbnailBlobs.delete(projectId)
}

const syncThumbnail = (project: ProjectMeta) => {
  const currentBlob = project.thumbnail
  const previousBlob = thumbnailBlobs.get(project.id)

  if (!currentBlob) {
    revokeThumbnail(project.id)
    return
  }

  if (currentBlob === previousBlob && thumbnailUrls.has(project.id)) return

  const existingUrl = thumbnailUrls.get(project.id)
  if (existingUrl) URL.revokeObjectURL(existingUrl)

  const url = URL.createObjectURL(currentBlob)
  thumbnailUrls.set(project.id, url)
  thumbnailBlobs.set(project.id, currentBlob)
}

watchEffect(() => {
  const nextIds = new Set(projects.value.map((p) => p.id))
  for (const id of Array.from(thumbnailUrls.keys())) {
    if (!nextIds.has(id)) revokeThumbnail(id)
  }

  for (const project of projects.value) syncThumbnail(project)
})

onBeforeUnmount(() => {
  for (const id of Array.from(thumbnailUrls.keys())) revokeThumbnail(id)
  thumbnailUrls.clear()
  thumbnailBlobs.clear()
})

const filteredProjects = computed(() => {
  const term = searchTerm.value
  const list = term
    ? projects.value.filter((project) => project.title.toLowerCase().includes(term))
    : projects.value
  return [...list].sort(sortComparators[sort.value])
})

const thumbnailUrlById = computed<Record<string, string | undefined>>(() => {
  const byId: Record<string, string | undefined> = {}
  for (const project of projects.value) {
    byId[project.id] = thumbnailFor(project)
  }
  return byId
})

function thumbnailFor(project: ProjectMeta): string | undefined {
  return thumbnailUrls.get(project.id)
}

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

