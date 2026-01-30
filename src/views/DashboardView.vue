<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Plus, Clock, LayoutGrid } from 'lucide-vue-next'
import { useProjectsStore } from '@/stores/projects'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ProjectCard from '@/components/ProjectCard.vue'
import type { ProjectMeta } from '@/db/db'

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

const isEmptyState = computed(() => filteredProjects.value.length === 0 && !isSearchActive.value)

function thumbnailFor(project: ProjectMeta): string | undefined {
  return thumbnailUrls.get(project.id)
}

async function handleOpenProject(id: string) {
  await router.push(`/project/${id}`)
}

async function handleCreateProject() {
  const meta = await projectsStore.createProject({ title: 'Untitled Project' })
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
    title: `Delete "${project.title}"?`,
    message: 'This action cannot be undone. This project will be permanently removed.',
    confirmText: 'Delete',
    variant: 'danger',
  })
  if (!confirmed) return
  await projectsStore.deleteProject(project.id)
  toast.success('Project deleted')
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
  <SidebarProvider class="h-screen w-full bg-sidebar text-foreground overflow-hidden">
    <Sidebar class="border-sidebar-border">
      <SidebarHeader class="h-16 px-4 flex-row items-center">
        <div class="flex items-center gap-2.5">
          <div class="w-6 h-6 bg-primary rounded flex items-center justify-center shadow-sm">
            <div class="w-3 h-3 bg-white rounded-sm"></div>
          </div>
          <span class="font-bold text-sm tracking-wide">FluxPDF</span>
        </div>
      </SidebarHeader>

      <SidebarContent class="px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton is-active>
              <Clock class="w-4 h-4" />
              <span>Recents</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <div class="px-4 py-2">
        <SidebarSeparator class="mx-0" />
      </div>

      <SidebarFooter class="px-4 py-4">
        <div class="ui-caption">
          <p>Local-First Architecture</p>
          <p class="opacity-50">v1.0.0</p>
        </div>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset class="min-w-0">
      <!-- Top Bar -->
      <header
        class="border-b border-border/50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 shrink-0 bg-sidebar"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <SidebarTrigger class="md:hidden" />
            <div
              class="md:hidden w-5 h-5 bg-primary rounded flex items-center justify-center shadow-sm"
            >
              <div class="w-2.5 h-2.5 bg-white rounded-sm"></div>
            </div>
            <h1 class="text-lg sm:text-xl font-semibold tracking-tight">Your Projects</h1>
          </div>
          <Button @click="handleCreateProject" class="sm:hidden" size="sm">
            <Plus class="w-4 h-4" />
            New
          </Button>
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto">
          <!-- Search -->
          <InputGroup class="w-full sm:w-64">
            <InputGroupAddon>
              <Search class="w-4 h-4" />
            </InputGroupAddon>
            <InputGroupInput v-model="query" placeholder="Search..." />
          </InputGroup>

          <!-- Create Button -->
          <Button @click="handleCreateProject" class="hidden sm:inline-flex">
            <Plus class="w-4 h-4" />
            New Project
          </Button>
        </div>
      </header>

      <!-- Scrollable Grid -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <!-- Loading Skeleton -->
        <div
          v-if="isLoading"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <Card v-for="i in 4" :key="i" class="overflow-hidden p-0 gap-0">
            <Skeleton class="aspect-video w-full rounded-none" />
            <div class="p-3.5 space-y-2">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-3 w-1/2" />
            </div>
          </Card>
        </div>

        <div v-else>
          <!-- Sort & Filter Bar -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <p class="text-sm text-muted-foreground font-medium">
              {{ filteredProjects.length }} Projects
            </p>

            <Select v-model="sort">
              <SelectTrigger size="sm" class="w-full sm:w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Empty State -->
          <Empty v-if="isEmptyState">
            <EmptyMedia variant="icon">
              <LayoutGrid class="w-5 h-5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>
                Create a new project to start merging, editing, and organizing your PDFs.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button @click="handleCreateProject">Start Creating</Button>
            </EmptyContent>
          </Empty>

          <!-- Project Grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <!-- Ghost Card (New Project) -->
            <button
              @click="handleCreateProject"
              class="group relative aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div
                class="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center group-hover:scale-110 transition-transform"
              >
                <Plus
                  class="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors"
                />
              </div>
              <span class="text-sm font-medium text-muted-foreground group-hover:text-primary"
                >Create New</span
              >
            </button>

            <ProjectCard
              v-for="project in filteredProjects"
              :key="project.id"
              :project="project"
              :thumbnail-url="thumbnailFor(project)"
              :is-editing="editingId === project.id"
              @open="handleOpenProject($event.id)"
              @rename-start="handleRenameStart"
              @rename-commit="handleRenameCommit"
              @rename-cancel="handleRenameCancel"
              @duplicate="handleDuplicate"
              @delete="handleDelete"
            />
          </div>
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
