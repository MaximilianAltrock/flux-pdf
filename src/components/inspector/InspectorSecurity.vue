<script setup lang="ts">
import { ref, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Eye, EyeOff } from 'lucide-vue-next'
import type { AppActions } from '@/composables/useAppActions'
import type { FacadeState } from '@/composables/useDocumentFacade'

const props = defineProps<{
  state: FacadeState
  actions: AppActions
}>()

const showUserPassword = ref(false)
const showOwnerPassword = ref(false)

const securityEncrypted = computed({
  get: () => props.state.document.security.isEncrypted,
  set: (value) => props.actions.setSecurity({ isEncrypted: value }),
})

const securityUserPassword = computed({
  get: () => props.state.document.security.userPassword ?? '',
  set: (value) => props.actions.setSecurity({ userPassword: value }),
})

const securityOwnerPassword = computed({
  get: () => props.state.document.security.ownerPassword ?? '',
  set: (value) => props.actions.setSecurity({ ownerPassword: value }),
})

const allowPrinting = computed({
  get: () => props.state.document.security.allowPrinting,
  set: (value) => props.actions.setSecurity({ allowPrinting: value }),
})

const allowCopying = computed({
  get: () => props.state.document.security.allowCopying,
  set: (value) => props.actions.setSecurity({ allowCopying: value }),
})

const allowModifying = computed({
  get: () => props.state.document.security.allowModifying,
  set: (value) => props.actions.setSecurity({ allowModifying: value }),
})
</script>

<template>
  <div class="space-y-6 pb-6">
    <div
      class="ui-panel-muted rounded-md p-3 transition-colors"
      :class="
        props.state.document.security.isEncrypted ? 'border-primary/40 ring-1 ring-primary/20' : ''
      "
    >
      <Field orientation="horizontal" class="items-center justify-between gap-4">
        <div class="space-y-1">
          <FieldLabel
            for="security-encrypted"
            class="ui-kicker transition-colors"
            :class="props.state.document.security.isEncrypted ? 'text-primary' : ''"
          >
            Encryption
          </FieldLabel>
          <p class="ui-caption leading-tight">Password protect this document</p>
        </div>
        <Switch id="security-encrypted" v-model="securityEncrypted" />
      </Field>
    </div>

    <!-- Password Fields (Animated) -->
    <div
      class="space-y-6 overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
      :class="
        props.state.document.security.isEncrypted
          ? 'opacity-100 max-h-[800px]'
          : 'opacity-0 max-h-0 pointer-events-none'
      "
    >
      <FieldGroup class="gap-5 px-1">
        <!-- User Pass -->
        <Field>
          <div class="flex justify-between items-center mb-2">
            <FieldLabel
              for="security-user-pass"
              class="ui-kicker flex items-center gap-2"
            >
              Open Password
            </FieldLabel>
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
              @click="showUserPassword = !showUserPassword"
            >
              <Eye v-if="!showUserPassword" class="w-3 h-3" />
              <EyeOff v-else class="w-3 h-3" />
            </Button>
          </div>
          <FieldContent>
            <Input
              id="security-user-pass"
              v-model="securityUserPassword"
              :type="showUserPassword ? 'text' : 'password'"
              class="h-8 text-xs ui-mono"
              placeholder="Enter password"
            />
          </FieldContent>
        </Field>

        <!-- Owner Pass -->
        <Field>
          <div class="flex justify-between items-center mb-2">
            <FieldLabel
              for="security-owner-pass"
              class="ui-kicker flex items-center gap-2"
            >
              Admin Password
            </FieldLabel>
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
              @click="showOwnerPassword = !showOwnerPassword"
            >
              <Eye v-if="!showOwnerPassword" class="w-3 h-3" />
              <EyeOff v-else class="w-3 h-3" />
            </Button>
          </div>
          <FieldContent>
            <Input
              id="security-owner-pass"
              v-model="securityOwnerPassword"
              :type="showOwnerPassword ? 'text' : 'password'"
              class="h-8 text-xs ui-mono"
              placeholder="Enter password"
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      <!-- Permissions Matrix -->
      <div class="space-y-4 pt-4 border-t border-border">
        <FieldLabel class="ui-kicker px-1">Access Control</FieldLabel>
        <div class="grid gap-2 ui-panel-muted rounded-md p-2">
          <label
            for="perm-print"
            class="flex items-center gap-3 p-2 rounded-sm hover:bg-muted/20 transition-colors cursor-pointer group"
          >
            <div class="flex items-center justify-center">
              <Checkbox
                id="perm-print"
                v-model="allowPrinting"
              />
            </div>
            <div class="space-y-0.5">
              <span class="ui-label">High-res printing</span>
              <p class="ui-caption leading-none">Allow high fidelity output</p>
            </div>
          </label>

          <label
            for="perm-copy"
            class="flex items-center gap-3 p-2 rounded-sm hover:bg-muted/20 transition-colors cursor-pointer group"
          >
            <div class="flex items-center justify-center">
              <Checkbox
                id="perm-copy"
                v-model="allowCopying"
              />
            </div>
            <div class="space-y-0.5">
              <span class="ui-label">Content copying</span>
              <p class="ui-caption leading-none">Extract text and media</p>
            </div>
          </label>

          <label
            for="perm-mod"
            class="flex items-center gap-3 p-2 rounded-sm hover:bg-muted/20 transition-colors cursor-pointer group"
          >
            <div class="flex items-center justify-center">
              <Checkbox
                id="perm-mod"
                v-model="allowModifying"
              />
            </div>
            <div class="space-y-0.5">
              <span class="ui-label">Modification</span>
              <p class="ui-caption leading-none">Reorder or delete pages</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
