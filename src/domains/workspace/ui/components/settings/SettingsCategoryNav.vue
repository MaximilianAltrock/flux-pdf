<script setup lang="ts">
import type { SettingsCategoryItem } from '@/shared/types/settings'

defineProps<{
  categories: ReadonlyArray<SettingsCategoryItem>
  activeCategory: string
}>()

const emit = defineEmits<{
  select: [categoryId: string]
}>()
</script>

<template>
  <aside class="ui-panel p-3 h-fit">
    <p class="ui-kicker px-2 pb-2">Categories</p>
    <div class="space-y-1">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        @click="emit('select', category.id)"
        class="w-full text-left rounded-md px-3 py-2.5 transition-colors border"
        :class="
          activeCategory === category.id
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-transparent border-transparent hover:bg-muted/30 text-foreground'
        "
      >
        <div class="flex items-center gap-2.5">
          <component :is="category.icon" class="w-4 h-4 shrink-0" />
          <div class="min-w-0">
            <p class="ui-label">{{ category.label }}</p>
            <p class="ui-caption truncate">{{ category.description }}</p>
          </div>
        </div>
      </button>
    </div>
  </aside>
</template>
