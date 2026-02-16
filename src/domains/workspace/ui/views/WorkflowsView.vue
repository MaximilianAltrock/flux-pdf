<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, type Component } from 'vue'
import { FileCheck2, RefreshCw, Workflow as WorkflowIcon } from 'lucide-vue-next'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useToast } from '@/shared/composables/useToast'
import { useWorkflowRunner } from '@/domains/workspace/application/useWorkflowRunner'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
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
import { useWorkflowsStore } from '@/domains/workspace/store/workflows.store'
import type { Workflow } from '@/shared/types/workflow'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import WorkflowCard from '@/domains/workspace/ui/components/workflows/WorkflowCard.vue'

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
          <WorkflowCard
            v-for="workflow in workflows"
            :key="workflow.id"
            :workflow="workflow"
            :icon="resolveWorkflowIcon(workflow.icon)"
            :run-status="getRunStatus(workflow.id)"
            :actions-disabled="runningWorkflowId !== null"
            :updated-at-label="formatUpdatedAt(workflow.updatedAt)"
            :step-count-label="formatStepCount(workflow.steps.length)"
            @drop-files="handleDropOnWorkflow(workflow, $event)"
            @duplicate="handleDuplicateWorkflow(workflow)"
            @run="handleRunPicker(workflow)"
            @delete="handleDeleteWorkflow(workflow)"
          />
        </div>
      </div>
    </div>
  </section>
</template>


