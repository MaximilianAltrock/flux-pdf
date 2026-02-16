<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/shared/components/ui/field'
import { Eye, EyeOff } from 'lucide-vue-next'
import { useDocumentActionsContext } from '@/domains/editor/application/useDocumentActions'
import { useDocumentStore } from '@/domains/document/store/document.store'

const actions = useDocumentActionsContext()
const document = useDocumentStore()

const showUserPassword = shallowRef(false)
const showOwnerPassword = shallowRef(false)

const securityEncrypted = computed({
  get: () => document.security.isEncrypted,
  set: (value) => actions.setSecurity({ isEncrypted: value }),
})

const securityUserPassword = computed({
  get: () => document.security.userPassword ?? '',
  set: (value) => actions.setSecurity({ userPassword: value }),
})

const securityOwnerPassword = computed({
  get: () => document.security.ownerPassword ?? '',
  set: (value) => actions.setSecurity({ ownerPassword: value }),
})

const allowPrinting = computed({
  get: () => document.security.allowPrinting,
  set: (value) => actions.setSecurity({ allowPrinting: value }),
})

const allowCopying = computed({
  get: () => document.security.allowCopying,
  set: (value) => actions.setSecurity({ allowCopying: value }),
})

const allowModifying = computed({
  get: () => document.security.allowModifying,
  set: (value) => actions.setSecurity({ allowModifying: value }),
})

watch(securityEncrypted, (isEncrypted) => {
  if (!isEncrypted) {
    actions.setSecurity({ userPassword: '', ownerPassword: '' })
  }
})
</script>

<template>
  <div class="space-y-6 pb-6">
    <div
        class="ui-panel-muted rounded-md p-3 transition-colors"
        :class="
        document.security.isEncrypted ? 'border-primary/40 ring-1 ring-primary/20' : ''
      "
    >
      <Field orientation="horizontal" class="items-center justify-between gap-4">
        <div class="space-y-1">
          <FieldLabel
            for="security-encrypted"
            class="ui-kicker transition-colors"
            :class="document.security.isEncrypted ? 'text-primary' : ''"
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
        document.security.isEncrypted
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
              :aria-label="showUserPassword ? 'Hide open password' : 'Show open password'"
              :aria-pressed="showUserPassword"
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
              :aria-label="showOwnerPassword ? 'Hide admin password' : 'Show admin password'"
              :aria-pressed="showOwnerPassword"
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

