<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/shared/components/ui/input'
import { Slider } from '@/shared/components/ui/slider'
import { Switch } from '@/shared/components/ui/switch'

const props = defineProps<{
  defaultGridZoomModel: number[]
  defaultGridZoom: number
  zoomMin: number
  zoomMax: number
  zoomStep: number
  autoGenerateOutlineSinglePage: boolean
  autoDeleteTrashDaysInput: string
}>()

const emit = defineEmits<{
  'update:defaultGridZoomModel': [value: number[]]
  'update:autoGenerateOutlineSinglePage': [value: boolean]
  'update:autoDeleteTrashDaysInput': [value: string]
}>()

const zoomModel = computed({
  get: () => props.defaultGridZoomModel,
  set: (value: number[]) => emit('update:defaultGridZoomModel', value),
})

const autoOutlineModel = computed({
  get: () => props.autoGenerateOutlineSinglePage,
  set: (value: boolean) => emit('update:autoGenerateOutlineSinglePage', value),
})

const trashDaysModel = computed({
  get: () => props.autoDeleteTrashDaysInput,
  set: (value: string) => emit('update:autoDeleteTrashDaysInput', value),
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-1">
      <h2 class="text-base font-semibold">Editor Defaults</h2>
      <p class="ui-caption">Applied to newly created projects.</p>
    </div>

    <div class="ui-panel-muted rounded-md p-4 space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="ui-label">Grid density</p>
        <span class="ui-mono ui-caption">{{ defaultGridZoom }}px</span>
      </div>
      <Slider v-model="zoomModel" :min="zoomMin" :max="zoomMax" :step="zoomStep" />
      <p class="ui-caption">
        Controls default thumbnail size in the editor page grid.
      </p>
    </div>

    <label
      for="settings-auto-outline"
      class="ui-panel-muted flex items-center justify-between gap-4 rounded-md p-4 cursor-pointer"
    >
      <div class="space-y-1">
        <p class="ui-label">Auto-generate outline for single-page imports</p>
        <p class="ui-caption">Moved here from the editor panel.</p>
      </div>
      <Switch id="settings-auto-outline" v-model="autoOutlineModel" />
    </label>

    <div class="ui-panel-muted rounded-md p-4 space-y-2">
      <label for="settings-trash-days" class="ui-label">Auto-delete trash after (days)</label>
      <Input id="settings-trash-days" v-model="trashDaysModel" type="number" min="1" max="365" />
      <p class="ui-caption">Retention policy is stored now and used by Trash automation later.</p>
    </div>
  </section>
</template>
