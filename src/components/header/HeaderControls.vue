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
    <div class="bg-muted/30 p-0.5 rounded-md border border-border/40 flex items-center">
      <ToggleGroup type="single" v-model="currentTool" class="h-7 gap-0">
        <ToggleGroupItem
          value="select"
          aria-label="Select tool"
          class="px-2 h-6 w-9 rounded-[3px] data-[state=on]:bg-background data-[state=on]:shadow-xs transition-all"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="flex items-center justify-center">
                <MousePointer2 class="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" :side-offset="8">
              <p class="text-xs">
                Select Tool
                <span class="text-muted-foreground ml-1 text-xxs font-mono">(V)</span>
              </p>
            </TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="razor"
          aria-label="Razor tool"
          class="px-2 h-6 w-9 rounded-[3px] data-[state=on]:bg-background data-[state=on]:shadow-xs transition-all"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="flex items-center justify-center">
                <Scissors class="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" :side-offset="8">
              <p class="text-xs">
                Razor Tool <span class="text-muted-foreground ml-1 text-xxs font-mono">(R)</span>
              </p>
            </TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <Separator orientation="vertical" class="!h-3 mx-1 opacity-20" />

    <!-- Zoom Area -->
    <div class="flex items-center gap-0.5 bg-muted/20 rounded-md border border-border/30 h-8 px-1">
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-[3px]"
        @click="$emit('zoom-out')"
      >
        <Minus class="w-3 h-3" />
      </Button>

      <span class="text-xxs font-bold w-9 text-center text-muted-foreground select-none font-mono">
        {{ Math.round(state.zoomPercentage.value) }}%
      </span>

      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-[3px]"
        @click="$emit('zoom-in')"
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
      class="h-8 font-bold px-4 gap-2 shadow-sm rounded-md bg-primary hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      <Download class="w-3.5 h-3.5" />
      <span class="text-xs">Export</span>
    </Button>
  </div>
</template>
