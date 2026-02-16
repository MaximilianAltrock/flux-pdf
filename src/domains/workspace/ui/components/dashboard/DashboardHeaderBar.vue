<script setup lang="ts">
import { Plus, Search } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/shared/components/ui/input-group'

const props = defineProps<{
  query: string
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  create: []
}>()
</script>

<template>
  <header
    class="border-b border-border/50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 shrink-0 bg-sidebar"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <SidebarTrigger class="md:hidden" />
        <div class="md:hidden w-5 h-5 bg-primary rounded flex items-center justify-center shadow-sm">
          <div class="w-2.5 h-2.5 bg-white rounded-sm"></div>
        </div>
        <h1 class="text-lg sm:text-xl font-semibold tracking-tight">Your Projects</h1>
      </div>
      <Button @click="emit('create')" class="sm:hidden" size="sm">
        <Plus class="w-4 h-4" />
        New
      </Button>
    </div>

    <div class="flex items-center gap-3 w-full sm:w-auto">
      <InputGroup class="w-full sm:w-64">
        <InputGroupAddon>
          <Search class="w-4 h-4" />
        </InputGroupAddon>
        <InputGroupInput :model-value="props.query" placeholder="Search..." @update:model-value="emit('update:query', String($event))" />
      </InputGroup>

      <Button @click="emit('create')" class="hidden sm:inline-flex">
        <Plus class="w-4 h-4" />
        New Project
      </Button>
    </div>
  </header>
</template>
