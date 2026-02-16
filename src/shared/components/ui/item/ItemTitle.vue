<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/shared/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="item-title"
    :class="cn('block min-w-0 max-w-full text-sm leading-snug font-medium', props.class)"
  >
    <slot />
  </div>
</template>
