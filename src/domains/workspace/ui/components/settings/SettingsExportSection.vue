<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/shared/components/ui/input'

const props = defineProps<{
  defaultAuthor: string
  filenamePattern: string
  filenamePreview: string
}>()

const emit = defineEmits<{
  'update:defaultAuthor': [value: string]
  'update:filenamePattern': [value: string]
}>()

const defaultAuthorModel = computed({
  get: () => props.defaultAuthor,
  set: (value: string) => emit('update:defaultAuthor', value),
})

const filenamePatternModel = computed({
  get: () => props.filenamePattern,
  set: (value: string) => emit('update:filenamePattern', value),
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-1">
      <h2 class="text-base font-semibold">Export Defaults</h2>
      <p class="ui-caption">Used by project creation and export filename suggestions.</p>
    </div>

    <div class="ui-panel-muted rounded-md p-4 space-y-2">
      <label for="settings-default-author" class="ui-label">Default author</label>
      <Input id="settings-default-author" v-model="defaultAuthorModel" placeholder="Jane Doe" />
      <p class="ui-caption">Applied to metadata when a new project is created.</p>
    </div>

    <div class="ui-panel-muted rounded-md p-4 space-y-3">
      <label for="settings-filename-pattern" class="ui-label">Filename pattern</label>
      <Input
        id="settings-filename-pattern"
        v-model="filenamePatternModel"
        placeholder="{name}_v{version}"
        class="ui-mono"
      />
      <p class="ui-caption">
        Tokens: <span class="ui-mono">{name}</span>,
        <span class="ui-mono">{original_name}</span>,
        <span class="ui-mono">{date}</span>,
        <span class="ui-mono">{version}</span>
      </p>
      <div class="rounded-md border border-border bg-background px-3 py-2">
        <p class="ui-kicker mb-1">Preview</p>
        <p class="ui-mono text-sm">{{ filenamePreview }}.pdf</p>
      </div>
    </div>
  </section>
</template>
