<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watchEffect,
  type ComponentPublicInstance,
} from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  Plus,
  MoreHorizontal,
  FileText,
  Clock,
  LayoutGrid,
} from 'lucide-vue-next'
import { useProjectManager } from '@/composables/useProjectManager'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { formatRelativeTime } from '@/utils/relative-time'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import type { ProjectMeta } from '@/db/db'

const router = useRouter()
const projectManager = useProjectManager()
const { confirm } = useConfirm()
const toast = useToast()

const projects = ref<ProjectMeta[]>([])
const isLoading = ref(true)
const query = ref('')
const sort = ref<'updated' | 'created' | 'title'>('updated')
const editingId = ref<string | null>(null)
const titleDraft = ref('')
const vFocusAuto = (el: Element | ComponentPublicInstance | null) => {
  if (!el) return
  const target =
    el instanceof HTMLInputElement
      ? el
      : (el as ComponentPublicInstance)?.$el?.querySelector?.('input') ||
        (el as ComponentPublicInstance)?.$el
  if (target instanceof HTMLInputElement) {
    target.focus()
    target.select()
  }
}

const thumbnailUrls = new Map<string, string>()
const thumbnailBlobs = new Map<string, Blob | undefined>()

async function refreshProjects() {
  // Don't set loading true if we already have data (prevents flashing on soft refresh)
  if (projects.value.length === 0) isLoading.value = true

  try {
    // Artificial delay removed, logic stays same
    projects.value = await projectManager.listRecentProjects(50)
  } catch (error) {
    console.error('Failed to load projects:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  refreshProjects()
})

// Memory Management for Blob URLs
watchEffect(() => {
  const nextIds = new Set(projects.value.map((p) => p.id))
  for (const [id, url] of thumbnailUrls) {
    if (!nextIds.has(id)) {
      URL.revokeObjectURL(url)
      thumbnailUrls.delete(id)
      thumbnailBlobs.delete(id)
    }
  }

  for (const project of projects.value) {
    const currentBlob = project.thumbnail
    const previousBlob = thumbnailBlobs.get(project.id)

    if (!currentBlob) {
      if (thumbnailUrls.has(project.id)) {
        const url = thumbnailUrls.get(project.id)
        if (url) URL.revokeObjectURL(url)
        thumbnailUrls.delete(project.id)
        thumbnailBlobs.delete(project.id)
      }
      continue
    }

    if (currentBlob === previousBlob && thumbnailUrls.has(project.id)) {
      continue
    }

    const existingUrl = thumbnailUrls.get(project.id)
    if (existingUrl) URL.revokeObjectURL(existingUrl)

    const url = URL.createObjectURL(currentBlob)
    thumbnailUrls.set(project.id, url)
    thumbnailBlobs.set(project.id, currentBlob)
  }
})

onBeforeUnmount(() => {
  for (const url of thumbnailUrls.values()) URL.revokeObjectURL(url)
  thumbnailUrls.clear()
  thumbnailBlobs.clear()
})

const filteredProjects = computed(() => {
  const term = query.value.trim().toLowerCase()
  let list = projects.value
  if (term) {
    list = list.filter((p) => p.title.toLowerCase().includes(term))
  }

  const sorted = [...list]
  switch (sort.value) {
    case 'created':
      sorted.sort((a, b) => b.createdAt - a.createdAt)
      break
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title))
      break
    default:
      sorted.sort((a, b) => b.updatedAt - a.updatedAt)
  }
  return sorted
})

function thumbnailFor(project: ProjectMeta): string | undefined {
  return thumbnailUrls.get(project.id)
}

async function handleOpenProject(id: string) {
  await router.push(`/project/${id}`)
}

async function handleCreateProject() {
  const meta = await projectManager.createProject({ title: 'Untitled Project' })
  await router.push(`/project/${meta.id}`)
}

async function handleDuplicate(project: ProjectMeta) {
  const created = await projectManager.duplicateProject(project.id)
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
  await projectManager.deleteProject(project.id)
  toast.success('Project deleted')
  await refreshProjects()
}

async function handleRenameStart(project: ProjectMeta) {
  editingId.value = project.id
  titleDraft.value = project.title
}

async function handleRenameCommit(project: ProjectMeta) {
  if (editingId.value !== project.id) return
  editingId.value = null
  const nextTitle = titleDraft.value.trim()
  if (!nextTitle || nextTitle === project.title) return
  await projectManager.renameProject(project.id, nextTitle)
  await refreshProjects()
}
</script>

<template>
  <div class="flex h-screen w-full bg-background text-foreground overflow-hidden">
    <!-- Sidebar (Minimal) -->
    <aside
      class="w-[260px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col shrink-0"
    >
      <!-- Logo Area -->
      <div class="h-16 flex items-center px-6 border-b border-sidebar-border/50">
        <div class="flex items-center gap-2.5">
          <div class="w-6 h-6 bg-primary rounded flex items-center justify-center shadow-sm">
            <div class="w-3 h-3 bg-white rounded-[1px]"></div>
          </div>
          <span class="font-bold text-sm tracking-wide">FluxPDF</span>
        </div>
      </div>

      <!-- Navigation -->
      <div class="p-3 flex-1">
        <nav class="space-y-1">
          <button
            class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary"
          >
            <Clock class="w-4 h-4" />
            Recents
          </button>
          <!-- Future: Add Favorites / Shared here -->
        </nav>
      </div>

      <!-- Footer Info -->
      <div class="p-4 text-[10px] text-muted-foreground border-t border-sidebar-border/50">
        <p>Local-First Architecture</p>
        <p class="opacity-50">v1.0.0</p>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 bg-background">
      <!-- Top Bar -->
      <header
        class="h-16 border-b border-border/50 flex items-center justify-between px-8 shrink-0 bg-card"
      >
        <h1 class="text-xl font-semibold tracking-tight">Your Projects</h1>

        <div class="flex items-center gap-3">
          <!-- Search -->
          <InputGroup class="w-64 bg-card/60 dark:bg-input/30">
            <InputGroupAddon class="text-muted-foreground">
              <Search class="w-4 h-4" />
            </InputGroupAddon>
            <InputGroupInput v-model="query" placeholder="Search..." class="text-sm" />
          </InputGroup>

          <!-- Create Button -->
          <Button
            @click="handleCreateProject"
            class="shadow-sm"
          >
            <Plus class="w-4 h-4" />
            New Project
          </Button>
        </div>
      </header>

      <!-- Scrollable Grid -->
      <div class="flex-1 overflow-y-auto p-8">
        <!-- Loading Skeleton -->
        <div
          v-if="isLoading"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <Skeleton
            v-for="i in 4"
            :key="i"
            class="h-64 rounded-xl bg-card border border-border"
          />
        </div>

        <div v-else>
          <!-- Sort & Filter Bar -->
          <div class="flex items-center justify-between mb-6">
            <p class="text-sm text-muted-foreground font-medium">
              {{ filteredProjects.length }} Projects
            </p>

            <Select v-model="sort">
              <SelectTrigger size="sm" class="w-[160px] text-xs font-medium">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Last Modified</SelectItem>
                <SelectItem value="created">Date Created</SelectItem>
                <SelectItem value="title">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Empty State -->
          <Empty
            v-if="filteredProjects.length === 0 && !query"
            class="bg-card/40 border-border/60 py-12 rounded-xl"
          >
            <EmptyMedia variant="icon" class="bg-muted/40 text-muted-foreground">
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
              class="group relative aspect-[4/3] rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-3 transition-all duration-200"
            >
              <div
                class="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm"
              >
                <Plus
                  class="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors"
                />
              </div>
              <span class="text-sm font-medium text-muted-foreground group-hover:text-primary"
                >Create New</span
              >
            </button>

            <!-- Project Card -->
            <Card
              v-for="project in filteredProjects"
              :key="project.id"
              class="group relative flex flex-col overflow-hidden p-0 gap-0 hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer"
              @click="handleOpenProject(project.id)"
            >
              <!-- Thumbnail -->
              <div
                class="aspect-[4/3] bg-muted/10 relative overflow-hidden border-b border-border/50"
              >
                <div v-if="thumbnailFor(project)" class="w-full h-full">
                  <img
                    :src="thumbnailFor(project)"
                    class="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                    alt="Thumbnail"
                  />
                  <!-- Inner shadow to separate white paper from white bg -->
                  <div class="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.05)]"></div>
                </div>

                <div
                  v-else
                  class="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30 gap-2"
                >
                  <FileText class="w-10 h-10" />
                </div>

                <!-- Hover Overlay Actions -->
                <div
                  class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <button
                        type="button"
                        @click.stop
                        @pointerdown.stop
                        class="p-1.5 bg-card hover:bg-muted/60 rounded-md shadow-sm text-foreground border border-border/70 transition-colors"
                      >
                        <MoreHorizontal class="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-40">
                      <DropdownMenuItem @select="handleOpenProject(project.id)"
                        >Open</DropdownMenuItem
                      >
                      <DropdownMenuItem @select="handleRenameStart(project)"
                        >Rename</DropdownMenuItem
                      >
                      <DropdownMenuItem @select="handleDuplicate(project)"
                        >Duplicate</DropdownMenuItem
                      >
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        @select="handleDelete(project)"
                        class="text-destructive focus:text-destructive"
                        >Delete</DropdownMenuItem
                      >
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <!-- Meta Info -->
              <div class="p-3.5">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <!-- Rename Input -->
                  <Input
                    v-if="editingId === project.id"
                    :ref="vFocusAuto"
                    v-model="titleDraft"
                    class="h-7 px-2 text-sm font-medium border-primary"
                    @blur="handleRenameCommit(project)"
                    @click.stop
                    @keyup.enter="handleRenameCommit(project)"
                  />
                  <!-- Static Title -->
                  <h3
                    v-else
                    class="font-medium text-sm text-foreground truncate"
                    :title="project.title"
                  >
                    {{ project.title }}
                  </h3>
                </div>

                <div class="text-[11px] text-muted-foreground">
                  {{ project.pageCount }} page{{ project.pageCount === 1 ? '' : 's' }} &bull;
                  {{ formatRelativeTime(project.updatedAt) }}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
