import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  ...pluginOxlint.configs['flat/recommended'],
  skipFormatting,

  {
    name: 'app/ui-single-word-components',
    files: ['src/shared/components/ui/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    name: 'app/domain-boundaries-domain',
    files: ['src/domains/**/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/**',
                '@/layouts/**',
                '@/views/**',
                '@/services/**',
                '@/stores/**',
                '@/domains/*/ui/**',
                '@/domains/*/store/**',
                '@/domains/*/infrastructure/**',
                'vue',
                'pinia',
                'vue-router',
              ],
              message: 'Domain layer must stay framework-free and independent of UI/infrastructure.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'app/domain-boundaries-domain-history-commands-transitional',
    files: ['src/domains/history/domain/commands/**/*.{ts,tsx}'],
    rules: {
      // Transitional exception: history commands currently orchestrate store mutations.
      // Goal is to move these imports behind an application executor in later phases.
      'no-restricted-imports': 'off',
    },
  },

  {
    name: 'app/domain-boundaries-application',
    files: ['src/domains/**/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/**',
                '@/layouts/**',
                '@/views/**',
                '@/domains/*/ui/**',
              ],
              message: 'Application layer should orchestrate use-cases and not depend on UI components.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'app/domain-boundaries-ui',
    files: ['src/domains/**/ui/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/domains/*/infrastructure/**'],
              message: 'UI should depend on application/domain APIs, not infrastructure adapters directly.',
            },
          ],
        },
      ],
    },
  },
)
