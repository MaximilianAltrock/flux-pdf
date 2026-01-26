<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { FacadeState } from '@/composables/useDocumentFacade'
import type { AppActions } from '@/composables/useAppActions'
import type { LintResult, Severity } from '@/types/linter'

const props = defineProps<{
  open: boolean
  state: FacadeState
  actions: AppActions
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const problems = computed(() => props.state.preflight.problems.value)

const pageNumberMap = computed(() => {
  const map = new Map<string, number>()
  props.state.document.contentPages.forEach((page, index) => {
    map.set(page.id, index + 1)
  })
  return map
})

function formatPages(result: LintResult): string {
  if (!result.pageIds || result.pageIds.length === 0) return 'Document'
  const numbers = result.pageIds
    .map((id) => pageNumberMap.value.get(id))
    .filter((n): n is number => typeof n === 'number')
  if (numbers.length === 0) return 'Document'
  return `Pages ${numbers.join(', ')}`
}

function severityLabel(severity: Severity): string {
  return severity.toUpperCase()
}

function severityClass(severity: Severity): string {
  if (severity === 'error') return 'bg-destructive/15 text-destructive border-destructive/30'
  if (severity === 'warning') return 'bg-amber-500/15 text-amber-600 border-amber-500/30'
  return 'bg-muted text-muted-foreground border-border'
}

function applyFix(problem: LintResult) {
  if (!problem.fix) return
  props.actions.applyPreflightFix(problem.fix, problem.pageIds)
}
</script>

<template>
  <Drawer :open="open" @update:open="(val) => emit('update:open', val)">
    <DrawerContent class="max-h-[70vh]">
      <div class="px-6 py-4 border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-3">
          <AlertTriangle v-if="problems.length > 0" class="w-5 h-5 text-amber-500" />
          <CheckCircle2 v-else class="w-5 h-5 text-emerald-500" />
          <div>
            <p class="text-sm font-semibold">Preflight Problems</p>
            <p class="text-xs text-muted-foreground">
              {{ problems.length === 0 ? 'No issues detected' : `${problems.length} issue${problems.length === 1 ? '' : 's'} found` }}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" class="text-xs" @click="emit('update:open', false)">
          Close
        </Button>
      </div>

      <div class="p-6 space-y-4 overflow-auto">
        <div v-if="problems.length === 0" class="ui-panel-muted rounded-lg p-6 text-center">
          <p class="text-sm font-semibold text-emerald-600">All clear</p>
          <p class="text-xs text-muted-foreground mt-1">Your document is ready to export.</p>
        </div>

        <div
          v-for="problem in problems"
          :key="problem.ruleId"
          class="border border-border rounded-lg p-4 bg-card"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge variant="outline" :class="severityClass(problem.severity)">
                  {{ severityLabel(problem.severity) }}
                </Badge>
                <span class="text-xs text-muted-foreground">{{ formatPages(problem) }}</span>
              </div>
              <p class="text-sm font-medium text-foreground">{{ problem.message }}</p>
            </div>

            <Button
              v-if="problem.fix"
              size="sm"
              class="shrink-0"
              @click="applyFix(problem)"
            >
              {{ problem.fix.label }}
            </Button>
          </div>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
