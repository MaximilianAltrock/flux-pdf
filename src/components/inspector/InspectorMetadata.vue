<script setup lang="ts">
import { ref, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileDown, Plus, X } from 'lucide-vue-next'
import type { DocumentMetadata } from '@/types'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const keywordInput = ref('')

const metadataTitle = computed({
  get: () => props.state.document.metadata.title,
  set: (value) => props.actions.setMetadata({ title: value }),
})
const metadataAuthor = computed({
  get: () => props.state.document.metadata.author,
  set: (value) => props.actions.setMetadata({ author: value }),
})
const metadataSubject = computed({
  get: () => props.state.document.metadata.subject,
  set: (value) => props.actions.setMetadata({ subject: value }),
})

type ReadonlyMetadata = Omit<Readonly<DocumentMetadata>, 'keywords'> & {
  keywords: ReadonlyArray<string>
}

function hasMeaningfulMetadata(metadata?: ReadonlyMetadata): metadata is ReadonlyMetadata {
  if (!metadata) return false
  return Boolean(
    metadata.title.trim() ||
      metadata.author.trim() ||
      metadata.subject.trim() ||
      metadata.keywords.length > 0,
  )
}

const metadataSources = computed(() =>
  props.state.document.sourceFileList.filter((source) => hasMeaningfulMetadata(source.metadata)),
)

function applyMetadataFromSource(sourceId: string) {
  props.actions.applyMetadataFromSource(sourceId)
}

function addKeyword() {
  const val = keywordInput.value.trim()
  if (val) props.actions.addKeyword(val)
  keywordInput.value = ''
}
function removeKeyword(k: string) {
  props.actions.removeKeyword(k)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xxs uppercase tracking-widest text-muted-foreground/80 font-bold">
          Import Metadata
        </p>
        <p class="text-xxs text-muted-foreground/50">
          Auto-fills once when empty, or apply manually from a source.
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="secondary"
            size="sm"
            class="h-7 px-2.5 text-xxs"
            :disabled="metadataSources.length === 0"
          >
            <FileDown class="w-3 h-3 mr-1.5" />
            Apply
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="min-w-[220px]">
          <DropdownMenuItem
            v-for="source in metadataSources"
            :key="source.id"
            @select="applyMetadataFromSource(source.id)"
          >
            <span class="truncate">{{ source.filename }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem v-if="metadataSources.length === 0" disabled>
            No metadata found
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <FieldGroup class="gap-5">
      <Field>
        <FieldLabel
          for="metadata-title"
          class="text-xxs uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
          >Document Title</FieldLabel
        >
        <FieldContent>
          <Input
            id="metadata-title"
            v-model="metadataTitle"
            type="text"
            class="h-8 text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60"
            placeholder="e.g. Project Specs 2026"
          />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel
          for="metadata-author"
          class="text-xxs uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
          >Author</FieldLabel
        >
        <FieldContent>
          <Input
            id="metadata-author"
            v-model="metadataAuthor"
            type="text"
            class="h-8 text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60"
            placeholder="Full name or organization"
          />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel
          for="metadata-subject"
          class="text-xxs uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
          >Subject</FieldLabel
        >
        <FieldContent>
          <Textarea
            id="metadata-subject"
            v-model="metadataSubject"
            rows="3"
            class="resize-none text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60 min-h-0"
            placeholder="Brief description of the document..."
          />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel
          for="metadata-keywords"
          class="text-xxs uppercase tracking-widest text-muted-foreground/80 font-bold mb-1.5"
          >Keywords</FieldLabel
        >
        <FieldContent class="space-y-2.5">
          <div
            v-if="props.state.document.metadata.keywords.length > 0"
            class="flex flex-wrap gap-1.5 items-center"
          >
            <Badge
              v-for="k in props.state.document.metadata.keywords"
              :key="k"
              variant="secondary"
              class="pl-2 pr-0.5 h-6 gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <span class="text-xxs font-medium leading-none">{{ k }}</span>
              <Button
                variant="ghost"
                size="icon"
                class="h-5 w-5 rounded-full hover:bg-background/50 hover:text-destructive transition-colors"
                @click="removeKeyword(k)"
              >
                <X class="w-3 h-3" />
              </Button>
            </Badge>
          </div>

          <div class="relative group">
            <Input
              id="metadata-keywords"
              v-model="keywordInput"
              @keydown.enter.prevent="addKeyword"
              @keydown.tab.prevent="addKeyword"
              @blur="addKeyword"
              type="text"
              class="h-8 text-xs bg-background/50 focus-visible:bg-background transition-colors border-border/60 pr-8"
              placeholder="Add tag and press Enter..."
            />
            <div
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary/40 transition-colors pointer-events-none"
            >
              <Plus class="w-3 h-3" />
            </div>
          </div>
        </FieldContent>
      </Field>
    </FieldGroup>
  </div>
</template>
