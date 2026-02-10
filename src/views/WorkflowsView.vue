<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, type Component } from 'vue'
import { Copy, FileCheck2, Play, RefreshCw, Trash2, Workflow as WorkflowIcon } from 'lucide-vue-next'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useWorkflowRunner } from '@/composables/useWorkflowRunner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkflowsStore } from '@/stores/workflows'
import type { Workflow } from '@/types/workflow'
import { formatRelativeTime } from '@/utils/relative-time'

const workflowsStore = useWorkflowsStore()
const { confirm } = useConfirm()
const toast = useToast()
const { runWorkflow, downloadWorkflowRun } = useWorkflowRunner()

const workflows = ref<Workflow[]>([])
const isLoading = shallowRef(true)
const runningWorkflowId = shallowRef<string | null>(null)
const runningProgress = shallowRef<{
  workflowId: string
  fileIndex: number
  totalFiles: number
  phase: 'loading' | 'applying' | 'saving' | 'zipping'
  fileName: string
} | null>(null)

const iconMap: Record<string, Component> = {
  workflow: WorkflowIcon,
  'file-check': FileCheck2,
}

const workflowCount = computed(() => workflows.value.length)
const isEmpty = computed(() => !isLoading.value && workflowCount.value === 0)

function resolveWorkflowIcon(icon: string): Component {
  return iconMap[icon] ?? WorkflowIcon
}

function formatUpdatedAt(timestamp: number): string {
  return formatRelativeTime(timestamp)
}

function formatStepCount(count: number): string {
  return `${count} step${count === 1 ? '' : 's'}`
}

async function refreshWorkflows(): Promise<void> {
  if (workflows.value.length === 0) isLoading.value = true
  try {
    workflows.value = await workflowsStore.listWorkflows()
  } finally {
    isLoading.value = false
  }
}

async function handleDeleteWorkflow(workflow: Workflow): Promise<void> {
  if (runningWorkflowId.value) return

  const confirmed = await confirm({
    title: `Delete workflow "${workflow.name}"?`,
    message: 'This action cannot be undone.',
    confirmText: 'Delete',
    variant: 'danger',
  })

  if (!confirmed) return
  await workflowsStore.deleteWorkflow(workflow.id)
  toast.success('Workflow deleted')
  await refreshWorkflows()
}

async function handleDuplicateWorkflow(workflow: Workflow): Promise<void> {
  if (runningWorkflowId.value) return

  const copy = await workflowsStore.duplicateWorkflow(workflow.id)
  if (!copy) return
  toast.success('Workflow duplicated')
  await refreshWorkflows()
}

function getRunStatus(workflowId: string): string | null {
  const progress = runningProgress.value
  if (!progress || progress.workflowId !== workflowId) return null

  if (progress.phase === 'zipping') return 'Creating ZIP archive...'
  return `Processing ${progress.fileIndex + 1}/${progress.totalFiles}: ${progress.fileName}`
}

async function runWorkflowWithFiles(workflow: Workflow, files: File[]): Promise<void> {
  if (runningWorkflowId.value) {
    toast.warning('A workflow is already running')
    return
  }

  if (files.length === 0) {
    toast.warning('No PDF files selected')
    return
  }

  runningWorkflowId.value = workflow.id
  runningProgress.value = null
  try {
    const runResult = await runWorkflow(workflow, files, {
      onProgress: (progress) => {
        runningProgress.value = {
          workflowId: workflow.id,
          fileIndex: progress.fileIndex,
          totalFiles: progress.totalFiles,
          phase: progress.phase,
          fileName: progress.fileName,
        }
      },
    })

    if (!runResult.ok) {
      toast.error('Workflow run failed', runResult.error.message)
      return
    }

    downloadWorkflowRun(runResult.value)

    toast.success(
      'Workflow completed',
      `${runResult.value.processedFiles} file${runResult.value.processedFiles === 1 ? '' : 's'} processed.`,
    )

    if (runResult.value.failedFiles.length > 0) {
      toast.warning(
        `${runResult.value.failedFiles.length} file${runResult.value.failedFiles.length === 1 ? '' : 's'} failed`,
        runResult.value.failedFiles[0]?.reason,
      )
    }
  } finally {
    runningWorkflowId.value = null
    runningProgress.value = null
  }
}

function normalizeDroppedFiles(fileList: FileList | null): File[] {
  if (!fileList) return []
  return Array.from(fileList).filter(
    (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name),
  )
}

async function handleDropOnWorkflow(workflow: Workflow, event: DragEvent): Promise<void> {
  const files = normalizeDroppedFiles(event.dataTransfer?.files ?? null)
  await runWorkflowWithFiles(workflow, files)
}

async function handleRunPicker(workflow: Workflow): Promise<void> {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.pdf,application/pdf'
  input.onchange = async (event) => {
    const target = event.target as HTMLInputElement | null
    const files = normalizeDroppedFiles(target?.files ?? null)
    await runWorkflowWithFiles(workflow, files)
  }
  input.click()
}

onMounted(refreshWorkflows)
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="border-b border-border/50 px-4 sm:px-6 lg:px-8 h-16 shrink-0 bg-sidebar">
      <div class="h-full flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <SidebarTrigger class="md:hidden" />
          <h1 class="text-lg sm:text-xl font-semibold tracking-tight">Workflows</h1>
        </div>

        <Button variant="outline" size="sm" class="gap-2" @click="refreshWorkflows">
          <RefreshCw class="w-4 h-4" />
          Refresh
        </Button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <Card v-for="i in 4" :key="i" class="overflow-hidden p-0 gap-0">
          <div class="p-4 space-y-2 border-b border-border/50">
            <Skeleton class="h-4 w-1/2" />
            <Skeleton class="h-3 w-2/3" />
          </div>
          <div class="p-4">
            <Skeleton class="h-24 w-full" />
          </div>
          <div class="p-4 pt-0 flex gap-2">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
          </div>
        </Card>
      </div>

      <Empty v-else-if="isEmpty">
        <EmptyMedia variant="icon">
          <WorkflowIcon class="w-5 h-5" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No workflows yet</EmptyTitle>
          <EmptyDescription>
            Create one from Editor history using "Save Workflow" in the History panel.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent />
      </Empty>

      <div v-else class="space-y-4">
        <p class="text-sm text-muted-foreground font-medium">
          {{ workflowCount }} Workflow{{ workflowCount > 1 ? 's' : '' }}
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Card v-for="workflow in workflows" :key="workflow.id" class="overflow-hidden p-0 gap-0">
            <div class="p-4 border-b border-border/50 space-y-2">
              <div class="flex items-center gap-2">
                <div class="ui-panel-muted rounded-md p-1.5">
                  <component :is="resolveWorkflowIcon(workflow.icon)" class="w-4 h-4" />
                </div>
                <h3 class="font-medium truncate">{{ workflow.name }}</h3>
              </div>
              <p class="ui-caption line-clamp-2 min-h-[2.5rem]">
                {{ workflow.description || 'No description yet.' }}
              </p>
              <p class="ui-caption">
                {{ formatStepCount(workflow.steps.length) }} - Updated {{ formatUpdatedAt(workflow.updatedAt) }}
              </p>
            </div>

            <div class="p-4">
              <div
                class="rounded-md border border-dashed border-border px-3 py-5 text-center bg-muted/10"
                @dragover.prevent
                @drop.prevent="handleDropOnWorkflow(workflow, $event)"
              >
                <p class="ui-caption">Drop PDFs here to process</p>
                <p
                  v-if="runningWorkflowId === workflow.id && getRunStatus(workflow.id)"
                  class="ui-caption text-primary mt-2"
                >
                  {{ getRunStatus(workflow.id) }}
                </p>
              </div>
            </div>

            <div class="p-4 pt-0 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                class="gap-2"
                :disabled="runningWorkflowId !== null"
                @click="handleDuplicateWorkflow(workflow)"
              >
                <Copy class="w-4 h-4" />
                Duplicate
              </Button>
              <Button
                size="sm"
                :disabled="runningWorkflowId !== null"
                class="gap-2"
                @click="handleRunPicker(workflow)"
              >
                <Play class="w-4 h-4" />
                Run on...
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="col-span-2 gap-2 text-destructive border-destructive/30 hover:text-destructive"
                :disabled="runningWorkflowId !== null"
                @click="handleDeleteWorkflow(workflow)"
              >
                <Trash2 class="w-4 h-4" />
                Delete
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </section>
</template>

