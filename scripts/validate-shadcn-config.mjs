import { readFile } from 'node:fs/promises'

const EXPECTED_MAIN_CSS = 'src/assets/main.css'
const EXPECTED_PATH_ALIAS = './src/*'
const EXPECTED_COMPONENT_ALIASES = {
  components: '@/shared/components',
  ui: '@/shared/components/ui',
  lib: '@/shared/lib',
  composables: '@/shared/composables',
}

async function readJson(filePath) {
  const content = await readFile(filePath, 'utf8')
  return JSON.parse(content)
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message)
}

async function main() {
  const errors = []

  const componentsConfig = await readJson('components.json')
  const tsAppConfig = await readJson('tsconfig.app.json')
  const viteConfig = await readFile('vite.config.ts', 'utf8')

  assert(
    componentsConfig.tailwind?.css === EXPECTED_MAIN_CSS,
    `components.json tailwind.css must be "${EXPECTED_MAIN_CSS}"`,
    errors,
  )
  assert(
    componentsConfig.tailwind?.cssVariables === true,
    'components.json tailwind.cssVariables must be true',
    errors,
  )

  for (const [aliasKey, expectedValue] of Object.entries(EXPECTED_COMPONENT_ALIASES)) {
    assert(
      componentsConfig.aliases?.[aliasKey] === expectedValue,
      `components.json aliases.${aliasKey} must be "${expectedValue}"`,
      errors,
    )
  }

  const tsPathAliases = tsAppConfig.compilerOptions?.paths
  const atPaths = tsPathAliases?.['@/*']
  assert(
    Array.isArray(atPaths) && atPaths.includes(EXPECTED_PATH_ALIAS),
    `tsconfig.app.json compilerOptions.paths["@/*"] must include "${EXPECTED_PATH_ALIAS}"`,
    errors,
  )

  const hasViteAtAlias = /alias\s*:\s*\{[\s\S]*['"]@['"]\s*:\s*path\.resolve\(__dirname,\s*['"]\.\/src['"]\)/m.test(
    viteConfig,
  )
  assert(
    hasViteAtAlias,
    'vite.config.ts must define resolve.alias "@" -> path.resolve(__dirname, "./src")',
    errors,
  )

  if (errors.length > 0) {
    console.error('shadcn-vue config validation failed:')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log('shadcn-vue config validation passed.')
}

await main()
