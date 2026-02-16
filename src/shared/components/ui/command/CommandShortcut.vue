<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/shared/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <span
    data-slot="command-shortcut"
    :class="cn('text-muted-foreground ml-auto ui-mono ui-2xs tracking-[0.2em]', props.class)"
  >
    <slot />
  </span>
</template>
