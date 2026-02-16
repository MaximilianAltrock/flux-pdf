<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/shared/lib/utils'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@/shared/components/ui/drawer'

const props = withDefaults(
  defineProps<{
    title: string
    description: string
    class?: HTMLAttributes['class']
    titleClass?: HTMLAttributes['class']
    descriptionClass?: HTMLAttributes['class']
  }>(),
  {
    titleClass: 'text-center',
    descriptionClass: 'sr-only',
  },
)
</script>

<template>
  <DrawerHeader :class="cn(props.class)">
    <DrawerTitle :class="cn(props.titleClass)">
      {{ props.title }}
    </DrawerTitle>
    <DrawerDescription :class="cn(props.descriptionClass)">
      {{ props.description }}
    </DrawerDescription>
    <slot />
  </DrawerHeader>
</template>
