<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
}>()

const problemCount = computed(() => props.state.preflight.problemCount.value)
const isHealthy = computed(() => props.state.preflight.isHealthy.value)

const label = computed(() =>
  isHealthy.value ? 'Preflight Passed' : `${problemCount.value} Problem${problemCount.value === 1 ? '' : 's'}`,
)
</script>

<template>
  <footer
    class="h-9 border-t border-sidebar-border bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 shrink-0"
  >
    <button
      type="button"
      class="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase"
      :class="isHealthy ? 'text-emerald-500' : 'text-amber-500'"
      @click="props.state.togglePreflightPanel"
    >
      <CheckCircle2 v-if="isHealthy" class="w-4 h-4" />
      <AlertTriangle v-else class="w-4 h-4" />
      <span>{{ label }}</span>
    </button>

    <span class="ui-caption text-muted-foreground">Preflight</span>
  </footer>
</template>
