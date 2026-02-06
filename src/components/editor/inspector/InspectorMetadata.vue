<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import { Input } from '@/components/ui/input'
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
import { useDocumentActionsContext } from '@/composables/useDocumentActions'
import { useDocumentStore } from '@/stores/document'

const actions = useDocumentActionsContext()
const document = useDocumentStore()

const keywordInput = shallowRef('')

const metadataTitle = computed({
  get: () => document.metadata.title,
  set: (value) => actions.setMetadata({ title: value }),
})
const metadataAuthor = computed({
  get: () => document.metadata.author,
  set: (value) => actions.setMetadata({ author: value }),
})
const metadataSubject = computed({
  get: () => document.metadata.subject,
  set: (value) => actions.setMetadata({ subject: value }),
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
  document.sourceFileList.filter((source) => hasMeaningfulMetadata(source.metadata)),
)

function applyMetadataFromSource(sourceId: string) {
  actions.applyMetadataFromSource(sourceId)
}

function addKeyword() {
  const val = keywordInput.value.trim()
  if (val) actions.addKeyword(val)
  keywordInput.value = ''
}
function removeKeyword(k: string) {
  actions.removeKeyword(k)
}
</script>

<template>
  <div class="space-y-6 pb-6">
    <div class="flex items-start justify-between gap-3 px-1">
      <div class="flex-1">
        <p class="ui-kicker mb-1">Smart Metadata</p>
        <p class="ui-caption leading-relaxed">
          Apply attributes from source files or define them manually.
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="secondary"
            size="sm"
            class="h-7 px-2.5 ui-2xs uppercase tracking-[0.16em]"
            :disabled="metadataSources.length === 0"
          >
            <FileDown class="w-3 h-3 mr-1.5" />
            Apply
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="min-w-[200px]">
          <DropdownMenuItem
            v-for="source in metadataSources"
            :key="source.id"
            @select="applyMetadataFromSource(source.id)"
            class="text-xs gap-2"
          >
            <span class="truncate">{{ source.filename }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="metadataSources.length === 0"
            disabled
            class="text-xs italic text-muted-foreground"
          >
            No source metadata
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <Separator class="opacity-30" />

    <FieldGroup class="gap-5 px-1">
      <Field>
        <FieldLabel
          for="metadata-title"
          class="ui-kicker mb-2 flex items-center gap-2"
        >
          Document Title
        </FieldLabel>
        <FieldContent>
          <Input
            id="metadata-title"
            v-model="metadataTitle"
            type="text"
            class="h-9 text-xs font-semibold"
            placeholder="e.g. Project Specs 2026"
          />
        </FieldContent>
      </Field>

      <div class="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel
            for="metadata-author"
            class="ui-kicker mb-2 flex items-center gap-2"
          >
            Author
          </FieldLabel>
          <FieldContent>
            <Input
              id="metadata-author"
              v-model="metadataAuthor"
              type="text"
              class="h-8 text-xs"
              placeholder="Name/Org"
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel
            for="metadata-subject"
            class="ui-kicker mb-2 flex items-center gap-2"
          >
            Subject
          </FieldLabel>
          <FieldContent>
            <Input
              id="metadata-subject"
              v-model="metadataSubject"
              type="text"
              class="h-8 text-xs"
              placeholder="Topic"
            />
          </FieldContent>
        </Field>
      </div>

      <Field>
        <FieldLabel
          for="metadata-keywords"
          class="ui-kicker mb-2 flex items-center gap-2"
        >
          Keywords / tags
        </FieldLabel>
        <FieldContent class="space-y-3">
          <div
            v-if="document.metadata.keywords.length > 0"
            class="flex flex-wrap gap-2 items-center min-h-[24px]"
          >
            <Badge
              v-for="k in document.metadata.keywords"
              :key="k"
              variant="secondary"
              class="pl-2 pr-0.5 h-6 gap-1 rounded-sm"
            >
              <span class="text-xs font-bold tracking-tight">{{ k }}</span>
              <Button
                variant="ghost"
                size="icon"
                class="h-5 w-5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                @click="removeKeyword(k)"
                :aria-label="`Remove keyword ${k}`"
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
              class="h-8 text-xs pr-8 pl-8"
              placeholder="Type tag and press Enter..."
            />
            <div
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none"
            >
              <Plus class="w-3 h-3" />
            </div>
          </div>
        </FieldContent>
      </Field>
    </FieldGroup>
  </div>
</template>
