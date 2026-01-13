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
  <div class="flex items-center justify-end gap-3 w-[280px]">
    <!-- Tool Switcher -->
    <ToggleGroup type="single" v-model="currentTool" variant="outline" class="h-8">
      <ToggleGroupItem value="select" aria-label="Select tool" class="px-2 h-7">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="flex items-center justify-center">
              <MousePointer2 class="w-3.5 h-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" :side-offset="8">
            <p>Select Tool <span class="text-muted-foreground ml-1 text-xxs">(V)</span></p>
          </TooltipContent>
        </Tooltip>
      </ToggleGroupItem>
      <ToggleGroupItem value="razor" aria-label="Razor tool" class="px-2 h-7">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="flex items-center justify-center">
              <Scissors class="w-3.5 h-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" :side-offset="8">
            <p>Razor Tool <span class="text-muted-foreground ml-1 text-xxs">(R)</span></p>
          </TooltipContent>
        </Tooltip>
      </ToggleGroupItem>
    </ToggleGroup>

    <Separator orientation="vertical" class="!h-4" />

    <!-- Theme Toggle -->
    <ThemeToggle />

    <Separator orientation="vertical" class="!h-4" />

    <!-- Zoom -->
    <div class="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground"
            @click="$emit('zoom-out')"
          >
            <Minus class="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" :side-offset="8">
          <p>Zoom Out <span class="text-muted-foreground ml-1 text-xxs">(⌘-)</span></p>
        </TooltipContent>
      </Tooltip>

      <span class="text-xs font-mono w-10 text-center text-muted-foreground select-none">
        {{ Math.round(state.zoomPercentage.value) }}%
      </span>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground"
            @click="$emit('zoom-in')"
          >
            <Plus class="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" :side-offset="8">
          <p>Zoom In <span class="text-muted-foreground ml-1 text-xxs">(⌘+)</span></p>
        </TooltipContent>
      </Tooltip>
    </div>

    <Separator orientation="vertical" class="!h-4" />

    <!-- Export CTA -->
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          @click="$emit('export')"
          :disabled="!canExport"
          size="sm"
          class="h-[30px] font-bold px-4 gap-2 shadow-sm"
        >
          <Download class="w-3.5 h-3.5" />
          <span>Export</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent v-if="!canExport" side="bottom" :side-offset="8">
        <p>Import files to export</p>
      </TooltipContent>
    </Tooltip>
  </div>
</template>
