<script setup lang="ts">
import { computed } from 'vue'
import { Download, MousePointer2, Scissors, Minus, Plus } from 'lucide-vue-next'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

defineEmits<{
  'zoom-in': []
  'zoom-out': []
  export: []
}>()

const currentTool = computed({
  get: () => props.state.currentTool.value,
  set: (val) => {
    props.actions.setCurrentTool(val as 'select' | 'razor')
  },
})

const canExport = computed(() => props.state.document.pageCount > 0)
</script>

<template>
  <div class="flex items-center justify-end gap-2 w-[300px]">
    <!-- Tool Switcher -->
    <div class="ui-panel-muted p-0.5 rounded-sm flex items-center">
      <ToggleGroup type="single" v-model="currentTool" variant="outline" size="sm" :spacing="0">
        <ToggleGroupItem value="select" aria-label="Select tool" class="w-9">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="flex items-center justify-center">
                <MousePointer2 class="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" :side-offset="8">
              <p class="ui-caption">
                Select Tool
                <span class="ui-mono ml-1">(V)</span>
              </p>
            </TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
        <ToggleGroupItem value="razor" aria-label="Razor tool" class="w-9">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="flex items-center justify-center">
                <Scissors class="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" :side-offset="8">
              <p class="ui-caption">Razor Tool <span class="ui-mono ml-1">(R)</span></p>
            </TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <Separator orientation="vertical" class="!h-3 mx-1 opacity-20" />

    <!-- Zoom Area -->
    <div class="ui-panel-muted h-8 px-1 rounded-sm flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        class="rounded-sm"
        @click="$emit('zoom-out')"
        aria-label="Zoom out"
      >
        <Minus class="w-3 h-3" />
      </Button>

      <span class="ui-caption ui-mono w-10 text-center select-none">
        {{ Math.round(state.zoomPercentage.value) }}%
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        class="rounded-sm"
        @click="$emit('zoom-in')"
        aria-label="Zoom in"
      >
        <Plus class="w-3 h-3" />
      </Button>
    </div>

    <Separator orientation="vertical" class="!h-3 mx-1 opacity-20" />

    <!-- Theme Toggle -->
    <ThemeToggle class="h-8 w-8 text-muted-foreground hover:text-foreground" />

    <Separator orientation="vertical" class="!h-3 mx-1 opacity-20" />

    <!-- Export CTA -->

    <Button
      @click="$emit('export')"
      :disabled="!canExport"
      size="sm"
      class="h-8 px-4 gap-2 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
    >
      <Download class="w-3.5 h-3.5" />
      <span class="text-xs font-semibold">Export</span>
    </Button>
  </div>
</template>
