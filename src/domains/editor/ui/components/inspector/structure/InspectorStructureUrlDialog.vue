<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

const props = defineProps<{
  open: boolean
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  close: []
}>()

const inputRef = useTemplateRef<HTMLInputElement>('inputRef')

const draft = computed({
  get: () => props.modelValue,
  set: (value: string | number) => emit('update:modelValue', String(value)),
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  },
)
</script>

<template>
  <Dialog :open="open" @update:open="(value) => (value ? null : emit('close'))">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Set external URL</DialogTitle>
        <DialogDescription>
          Add a link that opens when this outline item is selected.
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <Label for="outline-url">URL</Label>
        <Input
          id="outline-url"
          ref="inputRef"
          v-model="draft"
          type="url"
          placeholder="https://example.com"
          @keydown.enter.prevent="emit('save')"
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="emit('close')">Cancel</Button>
        <Button @click="emit('save')">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
