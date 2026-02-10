<script setup lang="ts">
import { computed, nextTick, shallowRef, watch, useTemplateRef, type ComponentPublicInstance } from 'vue'
import { FileText, MoreHorizontal } from 'lucide-vue-next'
import { formatRelativeTime } from '@/utils/relative-time'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { ProjectMeta } from '@/db/db'

const props = defineProps<{
  project: ProjectMeta
  thumbnailUrl?: string
  isEditing: boolean
}>()

const emit = defineEmits<{
  (e: 'open', project: ProjectMeta): void
  (e: 'rename-start', project: ProjectMeta): void
  (e: 'rename-commit', project: ProjectMeta, nextTitle: string): void
  (e: 'rename-cancel', project: ProjectMeta): void
  (e: 'duplicate', project: ProjectMeta): void
  (e: 'delete', project: ProjectMeta): void
}>()

const menuOpen = shallowRef(false)
const draftTitle = shallowRef(props.project.title)
const inputRef = useTemplateRef<ComponentPublicInstance | HTMLElement>('inputRef')

const pageLabel = computed(() => {
  const count = props.project.pageCount
  return `${count} page${count === 1 ? '' : 's'}`
})

const updatedLabel = computed(() => formatRelativeTime(props.project.updatedAt))

watch(
  () => props.project.title,
  (title) => {
    if (!props.isEditing) draftTitle.value = title
  },
)

const focusInput = () => {
  const element = inputRef.value instanceof HTMLElement ? inputRef.value : inputRef.value?.$el
  const input = element instanceof HTMLInputElement ? element : element?.querySelector?.('input')
  if (input instanceof HTMLInputElement) {
    input.focus()
    input.select()
  }
}

watch(
  () => props.isEditing,
  async (isEditing) => {
    if (!isEditing) return
    draftTitle.value = props.project.title
    await nextTick()
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(() => focusInput())
      return
    }
    focusInput()
  },
)

const handleCardClick = () => {
  if (props.isEditing || menuOpen.value) return
  emit('open', props.project)
}

const handleRenameSelect = (event?: Event) => {
  event?.preventDefault()
  event?.stopPropagation()
  menuOpen.value = false
  emit('rename-start', props.project)
}

const handleCommit = () => {
  emit('rename-commit', props.project, draftTitle.value.trim())
}

const handleCancel = () => {
  draftTitle.value = props.project.title
  emit('rename-cancel', props.project)
}
</script>

<template>
  <Card class="cursor-pointer transition-shadow hover:shadow-md" @click="handleCardClick">
    <CardHeader>
      <Input
        v-if="isEditing"
        ref="inputRef"
        v-model="draftTitle"
        @click.stop
        @blur="handleCommit"
        @keydown.enter.prevent="handleCommit"
        @keydown.esc.prevent="handleCancel"
      />
      <CardTitle v-else class="truncate" :title="project.title">
        {{ project.title }}
      </CardTitle>

      <CardAction>
        <DropdownMenu :open="menuOpen" @update:open="menuOpen = $event">
          <DropdownMenuTrigger as-child>
            <Button @click.stop @pointerdown.stop variant="outline" size="icon-sm">
              <MoreHorizontal class="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            class="w-40"
            @click.stop
            @pointerdown.stop
            @close-auto-focus="(event) => event.preventDefault()"
          >
            <DropdownMenuItem @select.stop="emit('open', project)">Open</DropdownMenuItem>
            <DropdownMenuItem @select.stop="handleRenameSelect">Rename</DropdownMenuItem>
            <DropdownMenuItem @select.stop="emit('duplicate', project)">Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select.stop="emit('delete', project)" variant="destructive">
              Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div class="aspect-video overflow-hidden rounded-md bg-muted/10">
        <div v-if="thumbnailUrl" class="h-full w-full">
          <img :src="thumbnailUrl" class="h-full w-full object-cover object-top" alt="Thumbnail" />
        </div>
        <div v-else class="flex h-full w-full items-center justify-center text-muted-foreground/50">
          <FileText class="h-10 w-10" />
        </div>
      </div>
    </CardContent>

    <CardFooter>
      <CardDescription>{{ pageLabel }} &bull; {{ updatedLabel }}</CardDescription>
    </CardFooter>
  </Card>
</template>
