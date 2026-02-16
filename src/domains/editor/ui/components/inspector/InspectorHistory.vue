<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { History, Save } from 'lucide-vue-next'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Textarea } from '@/shared/components/ui/textarea'
import { Timeline, TimelineItem, TimelineTime, TimelineTitle } from '@/shared/components/ui/timeline'
import { useToast } from '@/shared/composables/useToast'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useHistoryStore } from '@/domains/history/store/history.store'
import { useWorkflowsStore } from '@/domains/workspace/store/workflows.store'
import { formatTime } from '@/shared/utils/format'
import {
  buildWorkflowCandidateSteps,
  materializeWorkflowSteps,
  type WorkflowCandidateStep,
} from '@/shared/utils/workflow-history'

const { historyList, jumpTo } = useDocumentActionsContext()
const historyStore = useHistoryStore()
const workflowsStore = useWorkflowsStore()
const toast = useToast()
const { history, historyPointer } = storeToRefs(historyStore)

const historyScrollArea = useTemplateRef<InstanceType<typeof ScrollArea>>('historyScrollArea')

const isSaveDialogOpen = shallowRef(false)
const isSavingWorkflow = shallowRef(false)
const workflowName = shallowRef('')
const workflowDescription = shallowRef('')
const selectedCandidateIds = shallowRef<string[]>([])

const executedCommands = computed(() => {
  if (historyPointer.value < 0) return []
  return history.value.slice(0, historyPointer.value + 1).map((entry) => entry.command)
})

const workflowCandidateBuild = computed(() => buildWorkflowCandidateSteps(executedCommands.value))
const workflowCandidates = computed(() => workflowCandidateBuild.value.candidates)
const unsupportedCandidateCount = computed(() => workflowCandidateBuild.value.unsupportedCount)

const selectedCandidates = computed(() => {
  const selectedIds = new Set(selectedCandidateIds.value)
  return workflowCandidates.value.filter((candidate) => selectedIds.has(candidate.commandId))
})

const canOpenSaveWorkflowDialog = computed(() => workflowCandidates.value.length > 0)

const canSaveWorkflow = computed(
  () =>
    workflowName.value.trim().length > 0 &&
    selectedCandidates.value.length > 0 &&
    !isSavingWorkflow.value,
)

watch(
  () => historyList.value.length,
  async (newLength, oldLength) => {
    if (newLength > oldLength) {
      await nextTick()
      if (historyScrollArea.value) {
        const viewport = historyScrollArea.value.$el.querySelector(
          '[data-slot="scroll-area-viewport"]',
        )
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth',
          })
        }
      }
    }
  },
)

function buildDefaultWorkflowName(): string {
  const formatted = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  return `Workflow ${formatted}`
}

function resetSaveWorkflowForm(): void {
  workflowName.value = ''
  workflowDescription.value = ''
  selectedCandidateIds.value = []
}

function openSaveWorkflowDialog(): void {
  if (!canOpenSaveWorkflowDialog.value) {
    toast.warning(
      'No supported workflow steps found',
      'Use rotate or first/last page delete actions before saving a workflow.',
    )
    return
  }

  const defaultSelection = workflowCandidates.value
    .filter((candidate) => candidate.includeByDefault)
    .map((candidate) => candidate.commandId)

  selectedCandidateIds.value =
    defaultSelection.length > 0
      ? defaultSelection
      : workflowCandidates.value.map((candidate) => candidate.commandId)

  workflowName.value = buildDefaultWorkflowName()
  workflowDescription.value = ''
  isSaveDialogOpen.value = true
}

function isCandidateSelected(id: string): boolean {
  return selectedCandidateIds.value.includes(id)
}

function setCandidateSelected(id: string, checked: boolean): void {
  const next = new Set(selectedCandidateIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedCandidateIds.value = Array.from(next)
}

function onCandidateChecked(commandId: string, checked: boolean | 'indeterminate'): void {
  setCandidateSelected(commandId, checked === true)
}

function getStepPreview(candidate: WorkflowCandidateStep): string {
  const params = Object.keys(candidate.params)
  if (params.length === 0) return candidate.commandType
  return `${candidate.commandType} - ${params.length} params`
}

async function handleSaveWorkflow(): Promise<void> {
  if (!canSaveWorkflow.value) return

  isSavingWorkflow.value = true
  try {
    const steps = materializeWorkflowSteps(selectedCandidates.value)

    await workflowsStore.createWorkflow({
      name: workflowName.value.trim(),
      description: workflowDescription.value.trim(),
      icon: 'workflow',
      steps,
    })

    toast.success(
      'Workflow saved',
      `${steps.length} step${steps.length === 1 ? '' : 's'} captured from session history.`,
    )
    isSaveDialogOpen.value = false
    resetSaveWorkflowForm()
  } catch (error) {
    console.error('Failed to save workflow:', error)
    toast.error('Failed to save workflow', error instanceof Error ? error.message : 'Unknown error')
  } finally {
    isSavingWorkflow.value = false
  }
}

function onSaveDialogOpenChange(open: boolean): void {
  isSaveDialogOpen.value = open
  if (!open) {
    resetSaveWorkflowForm()
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <div class="h-9 px-4 border-b border-sidebar-border flex items-center justify-between bg-sidebar">
      <h2 class="ui-kicker flex items-center gap-2">
        Session History
        <span class="w-1 h-1 rounded-full bg-primary/40"></span>
      </h2>
      <div class="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          class="h-6 px-2.5 gap-1.5"
          :disabled="!canOpenSaveWorkflowDialog"
          @click="openSaveWorkflowDialog"
        >
          <Save class="w-3 h-3" />
          Save Workflow
        </Button>
        <Badge variant="outline" class="ui-mono ui-2xs h-4 opacity-60 px-1.5">
          {{ historyList.length }} steps
        </Badge>
      </div>
    </div>

    <ScrollArea ref="historyScrollArea" class="flex-1 min-h-0 bg-sidebar">
      <div class="py-6 px-4">
        <Timeline v-if="historyList.length > 0" size="sm" variant="history" class="w-full">
          <TimelineItem
            v-for="(entry, index) in historyList"
            :key="entry.pointer"
            :status="entry.isCurrent ? 'in-progress' : entry.isUndone ? 'pending' : 'completed'"
            :show-connector="index !== historyList.length - 1"
            icon-size="lg"
            class="cursor-pointer group relative mb-6 last:mb-0 rounded-sm focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none"
            @click="jumpTo(entry.pointer)"
            @keydown.enter.prevent="jumpTo(entry.pointer)"
            @keydown.space.prevent="jumpTo(entry.pointer)"
            role="button"
            tabindex="0"
            :aria-label="`Jump to ${entry.command.name}`"
          >
            <template #title>
              <TimelineTitle
                class="ui-label truncate transition-colors leading-tight"
                :class="[
                  entry.isCurrent
                    ? 'text-primary'
                    : 'text-foreground/80 group-hover:text-foreground',
                  entry.isUndone
                    ? 'text-muted-foreground/40 italic line-through decoration-muted-foreground/20'
                    : '',
                ]"
              >
                {{ entry.command.name }}
              </TimelineTitle>
            </template>
            <template #description>
              <div class="flex items-center gap-2 mt-0.5">
                <TimelineTime class="ui-caption ui-mono uppercase tracking-[0.2em]">
                  {{ formatTime(entry.timestamp, true) }}
                </TimelineTime>
              </div>
            </template>
          </TimelineItem>
        </Timeline>

        <div v-else class="h-full flex flex-col items-center justify-center p-8 text-center">
          <div class="ui-panel-muted rounded-md p-3 mb-2">
            <History class="w-5 h-5" />
          </div>
          <p class="ui-kicker opacity-70">No Activity</p>
        </div>
      </div>
    </ScrollArea>
  </div>

  <Dialog :open="isSaveDialogOpen" @update:open="onSaveDialogOpenChange">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Save History as Workflow</DialogTitle>
        <DialogDescription>
          Select abstract steps to keep. Supported today: rotate all/even/odd and delete first/last page.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5 sm:col-span-1">
            <label class="ui-kicker" for="workflow-name">Name</label>
            <Input id="workflow-name" v-model="workflowName" placeholder="Fix Invoices" />
          </div>
          <div class="space-y-1.5 sm:col-span-1">
            <label class="ui-kicker" for="workflow-description">Description</label>
            <Textarea
              id="workflow-description"
              v-model="workflowDescription"
              rows="2"
              placeholder="Rotate and clean up imported invoices."
            />
          </div>
        </div>

        <div class="ui-panel-muted rounded-md border border-border/60">
          <div class="px-3 py-2 border-b border-border/60 flex items-center justify-between">
            <p class="ui-kicker">Steps</p>
            <span class="ui-caption">
              {{ selectedCandidates.length }} / {{ workflowCandidates.length }} selected
            </span>
          </div>

          <p v-if="unsupportedCandidateCount > 0" class="px-3 pt-2 ui-caption text-muted-foreground">
            {{ unsupportedCandidateCount }} history command{{
              unsupportedCandidateCount === 1 ? '' : 's'
            }} could not be abstracted and were skipped.
          </p>

          <ScrollArea class="max-h-64">
            <div class="divide-y divide-border/40">
              <label
                v-for="candidate in workflowCandidates"
                :key="candidate.commandId"
                class="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <Checkbox
                  :checked="isCandidateSelected(candidate.commandId)"
                  @update:checked="onCandidateChecked(candidate.commandId, $event)"
                  class="mt-0.5"
                />
                <div class="min-w-0">
                  <p class="ui-label truncate">{{ candidate.label }}</p>
                  <p class="ui-caption">{{ getStepPreview(candidate) }}</p>
                </div>
              </label>
            </div>
          </ScrollArea>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button type="button" variant="outline" @click="onSaveDialogOpenChange(false)">
          Cancel
        </Button>
        <Button type="button" :disabled="!canSaveWorkflow" @click="handleSaveWorkflow">
          Save Workflow
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>


