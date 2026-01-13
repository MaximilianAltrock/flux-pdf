<script setup lang="ts">
import { ref, computed } from 'vue'
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
  <div class="space-y-6 pb-6">
    <div class="flex items-start justify-between gap-3 px-1">
      <div class="flex-1">
        <p class="text-xxs uppercase tracking-[0.1em] text-muted-foreground/60 font-bold mb-1">
          Smart Metadata
        </p>
        <p class="text-xxs text-muted-foreground/40 leading-relaxed font-medium">
          Apply attributes from source files or define them manually.
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2.5 text-xxs font-bold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 rounded-[4px] border border-primary/10"
            :disabled="metadataSources.length === 0"
          >
            <FileDown class="w-3 h-3 mr-1.5" />
            Apply
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          class="min-w-[200px] shadow-xl border-border/40 backdrop-blur-xl"
        >
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
            class="text-xs italic text-muted-foreground/50"
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
          class="text-xxs uppercase tracking-[0.15em] text-muted-foreground/50 font-bold mb-2 flex items-center gap-2"
        >
          <div class="w-1 h-1 rounded-full bg-primary/40"></div>
          Document Title
        </FieldLabel>
        <FieldContent>
          <Input
            id="metadata-title"
            v-model="metadataTitle"
            type="text"
            class="h-9 text-xs font-semibold bg-muted/20 focus-visible:bg-background border-border/30 rounded-[4px] placeholder:text-muted-foreground/30 transition-all hover:bg-muted/40"
            placeholder="e.g. Project Specs 2026"
          />
        </FieldContent>
      </Field>

      <div class="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel
            for="metadata-author"
            class="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-bold mb-2 flex items-center gap-2"
          >
            <div class="w-1 h-1 rounded-full bg-primary/40"></div>
            Author
          </FieldLabel>
          <FieldContent>
            <Input
              id="metadata-author"
              v-model="metadataAuthor"
              type="text"
              class="h-8 text-xs bg-muted/20 focus-visible:bg-background border-border/30 rounded-[4px] placeholder:text-muted-foreground/30 transition-all hover:bg-muted/40"
              placeholder="Name/Org"
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel
            for="metadata-subject"
            class="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-bold mb-2 flex items-center gap-2"
          >
            <div class="w-1 h-1 rounded-full bg-primary/40"></div>
            Subject
          </FieldLabel>
          <FieldContent>
            <Input
              id="metadata-subject"
              v-model="metadataSubject"
              type="text"
              class="h-8 text-[11px] bg-muted/20 focus-visible:bg-background border-border/30 rounded-[4px] placeholder:text-muted-foreground/30 transition-all hover:bg-muted/40"
              placeholder="Topic"
            />
          </FieldContent>
        </Field>
      </div>

      <Field>
        <FieldLabel
          for="metadata-keywords"
          class="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-bold mb-2 flex items-center gap-2"
        >
          <div class="w-1 h-1 rounded-full bg-primary/40"></div>
          Keywords / tags
        </FieldLabel>
        <FieldContent class="space-y-3">
          <div
            v-if="props.state.document.metadata.keywords.length > 0"
            class="flex flex-wrap gap-2 items-center min-h-[24px]"
          >
            <Badge
              v-for="k in props.state.document.metadata.keywords"
              :key="k"
              variant="secondary"
              class="pl-2 pr-0.5 h-6 gap-1 bg-background border border-border/40 text-foreground/70 hover:border-primary/30 transition-all rounded-[4px] shadow-xs"
            >
              <span class="text-xxs font-bold tracking-tight">{{ k }}</span>
              <Button
                variant="ghost"
                size="icon"
                class="h-5 w-5 rounded-[3px] hover:bg-destructive/10 hover:text-destructive transition-colors"
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
              class="h-8 text-xs bg-muted/20 focus-visible:bg-background border-border/30 rounded-[4px] pr-8 pl-8 placeholder:text-muted-foreground/30 transition-all"
              placeholder="Type tag and press Enter..."
            />
            <div
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within:text-primary transition-colors pointer-events-none"
            >
              <Plus class="w-3 h-3" />
            </div>
          </div>
        </FieldContent>
      </Field>
    </FieldGroup>
  </div>
</template>
