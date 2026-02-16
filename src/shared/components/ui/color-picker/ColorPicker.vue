<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '@/shared/components/ui/button'
import { computed, shallowRef, useTemplateRef } from 'vue'
import 'vanilla-colorful'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

defineOptions({
  inheritAttrs: false,
})

interface ColorPickerProps {
  modelValue?: string
  disabled?: boolean
  name?: string
  class?: HTMLAttributes['class']
  size?: ButtonVariants['size']
  variant?: ButtonVariants['variant']
}

const props = withDefaults(defineProps<ColorPickerProps>(), {
  disabled: false,
  variant: 'outline',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const modelValue = computed({
  get: () => props.modelValue,
  set: (value: string | undefined) => {
    if (typeof value === 'string') {
      emit('update:modelValue', value)
    }
  },
})

const open = shallowRef(false)
const inputRef = useTemplateRef<HTMLInputElement>('input')
const hexPickerTag = 'hex-color-picker'

const parsedValue = computed(() => modelValue.value || '#FFFFFF')

const handlePickerChange = (event: Event) => {
  const detail = (event as CustomEvent<{ value: string }>).detail
  if (detail?.value) {
    modelValue.value = detail.value
  }
}

const handleInputChange = (value: string | number) => {
  modelValue.value = String(value)
}

defineExpose({
  inputRef,
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child :disabled="disabled">
      <Button
        v-bind="$attrs"
        :class="cn('block', props.class)"
        :disabled="disabled"
        :name="name"
        :size="size"
        :style="{ backgroundColor: parsedValue }"
        :variant="variant"
        @click="open = true"
      >
        <span class="sr-only">Pick a color</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-full">
      <component
        :is="hexPickerTag"
        class="h-40 w-full"
        :color="parsedValue"
        @color-changed="handlePickerChange"
      />
      <Input
        ref="input"
        class="mt-3"
        :maxlength="7"
        :model-value="parsedValue"
        @update:model-value="handleInputChange"
      />
    </PopoverContent>
  </Popover>
</template>
