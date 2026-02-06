<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { autoGenerateOutlineSinglePage } = storeToRefs(settings)
</script>

<template>
  <div class="space-y-4 pb-6">
    <Field>
      <FieldLabel class="ui-kicker">Outline</FieldLabel>
      <label
        for="opt-outline-single-page"
        class="mt-2 flex items-center gap-3 p-2 rounded-sm hover:bg-muted/20 transition-colors cursor-pointer group"
      >
        <div class="flex items-center justify-center">
          <Checkbox
            id="opt-outline-single-page"
            v-model="autoGenerateOutlineSinglePage"
          />
        </div>
        <div class="space-y-0.5">
          <span class="ui-label">Auto-generate for single pages</span>
          <p class="ui-caption leading-none">
            Create an outline entry for single-page imports
          </p>
        </div>
      </label>
    </Field>
  </div>
</template>
