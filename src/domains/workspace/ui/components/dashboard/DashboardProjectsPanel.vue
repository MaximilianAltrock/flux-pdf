<script setup lang="ts">
import { computed } from 'vue'
import { LayoutGrid, Plus } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import ProjectCard from '@/domains/workspace/ui/components/dashboard/ProjectCard.vue'
import type { ProjectMeta } from '@/shared/infrastructure/db'

const props = defineProps<{
  isLoading: boolean
  isSearchActive: boolean
  filteredProjects: ProjectMeta[]
  sortOptions: ReadonlyArray<{ value: string; label: string }>
  sort: string
  editingId: string | null
  thumbnailUrlById: Record<string, string | undefined>
}>()

const emit = defineEmits<{
  'update:sort': [value: string]
  create: []
  open: [projectId: string]
  renameStart: [project: ProjectMeta]
  renameCommit: [project: ProjectMeta, nextTitle: string]
  renameCancel: []
  duplicate: [project: ProjectMeta]
  delete: [project: ProjectMeta]
}>()

const isEmptyState = computed(
  () => props.filteredProjects.length === 0 && !props.isSearchActive,
)
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p class="text-sm text-muted-foreground font-medium">{{ filteredProjects.length }} Projects</p>

        <Select :model-value="sort" @update:model-value="emit('update:sort', String($event))">
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
          <Button @click="emit('create')">Start Creating</Button>
        </EmptyContent>
      </Empty>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <button
          @click="emit('create')"
          class="group relative aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          <div
            class="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center group-hover:scale-110 transition-transform"
          >
            <Plus class="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span class="text-sm font-medium text-muted-foreground group-hover:text-primary">
            Create New
          </span>
        </button>

        <ProjectCard
          v-for="project in filteredProjects"
          :key="project.id"
          :project="project"
          :thumbnail-url="thumbnailUrlById[project.id]"
          :is-editing="editingId === project.id"
          @open="emit('open', $event.id)"
          @rename-start="emit('renameStart', $event)"
          @rename-commit="
            (project, nextTitle) => emit('renameCommit', project, nextTitle)
          "
          @rename-cancel="emit('renameCancel')"
          @duplicate="emit('duplicate', $event)"
          @delete="emit('delete', $event)"
        />
      </div>
    </div>
  </div>
</template>
