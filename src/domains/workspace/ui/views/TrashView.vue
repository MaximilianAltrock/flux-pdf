<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw, Trash2 } from 'lucide-vue-next'
import {
  useLiveProjectList,
  useProjectCatalog,
  useProjectThumbnailUrls,
} from '@/domains/workspace/application'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useToast } from '@/shared/composables/useToast'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty'
import type { ProjectMeta } from '@/shared/infrastructure/db'

const projectCatalog = useProjectCatalog()
const { confirm } = useConfirm()
const toast = useToast()

const { items: trashedProjects, isLoading } = useLiveProjectList(
  () => projectCatalog.listTrashedProjects(),
  {
    onError: (error) => {
      console.error('Failed to subscribe to trashed projects:', error)
    },
  },
)

const projectCount = computed(() => trashedProjects.value.length)
const isEmpty = computed(() => !isLoading.value && projectCount.value === 0)
const { thumbnailFor } = useProjectThumbnailUrls(trashedProjects)

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

async function handleRestore(project: ProjectMeta): Promise<void> {
  await projectCatalog.restoreProject(project.id)
  toast.success('Project restored')
}

async function handleDeleteForever(project: ProjectMeta): Promise<void> {
  const confirmed = await confirm({
    title: `Delete "${project.title}" permanently?`,
    message: 'This action cannot be undone. The project and its history will be removed.',
    confirmText: 'Delete Permanently',
    variant: 'danger',
  })

  if (!confirmed) return

  await projectCatalog.permanentlyDeleteProject(project.id)
  toast.success('Project permanently deleted')
}

async function handleEmptyTrash(): Promise<void> {
  if (projectCount.value === 0) return

  const confirmed = await confirm({
    title: 'Empty trash?',
    message: `This permanently deletes ${projectCount.value} project${projectCount.value > 1 ? 's' : ''}.`,
    confirmText: 'Empty Trash',
    variant: 'danger',
  })

  if (!confirmed) return

  const deletedCount = await projectCatalog.emptyTrash()
  if (deletedCount > 0) {
    toast.success(`Deleted ${deletedCount} project${deletedCount > 1 ? 's' : ''}`)
  }
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="border-b border-border/50 px-4 sm:px-6 lg:px-8 h-16 shrink-0 bg-sidebar">
      <div class="h-full flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <SidebarTrigger class="md:hidden" />
          <h1 class="text-lg sm:text-xl font-semibold tracking-tight">Trash</h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="gap-2"
          :disabled="projectCount === 0"
          @click="handleEmptyTrash"
        >
          <Trash2 class="w-4 h-4" />
          Empty Trash
        </Button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <Card v-for="i in 4" :key="i" class="overflow-hidden p-0 gap-0">
          <Skeleton class="aspect-video w-full rounded-none" />
          <div class="p-3.5 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-1/2" />
          </div>
        </Card>
      </div>

      <Empty v-else-if="isEmpty">
        <EmptyMedia variant="icon">
          <Trash2 class="w-5 h-5" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Your trash is empty</EmptyTitle>
          <EmptyDescription>
            Projects moved to trash will appear here until you restore or permanently delete them.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent />
      </Empty>

      <div v-else class="space-y-4">
        <p class="text-sm text-muted-foreground font-medium">
          {{ projectCount }} Project{{ projectCount > 1 ? 's' : '' }} in Trash
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Card
            v-for="project in trashedProjects"
            :key="project.id"
            class="overflow-hidden p-0 gap-0 border-border/80"
          >
            <div class="aspect-video w-full bg-muted/30 border-b border-border/60">
              <img
                v-if="thumbnailFor(project)"
                :src="thumbnailFor(project)"
                :alt="project.title"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full grid place-items-center text-muted-foreground">
                <Trash2 class="w-6 h-6" />
              </div>
            </div>

            <div class="p-4 space-y-3">
              <div class="space-y-1">
                <h3 class="font-medium leading-tight line-clamp-2">{{ project.title }}</h3>
                <p class="ui-caption">{{ project.pageCount }} page{{ project.pageCount === 1 ? '' : 's' }}</p>
                <p class="ui-caption">Moved: {{ formatDate(project.trashedAt) }}</p>
              </div>

              <div class="flex items-center gap-2">
                <Button size="sm" class="flex-1 gap-2" @click="handleRestore(project)">
                  <RotateCcw class="w-4 h-4" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="flex-1 gap-2 text-destructive border-destructive/30 hover:text-destructive"
                  @click="handleDeleteForever(project)"
                >
                  <Trash2 class="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </section>
</template>
