import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT_DIR = process.cwd()
const LEGACY_DIRS = [
  'src/stores',
  'src/services',
  'src/commands',
  'src/components',
  'src/composables',
  'src/views',
  'src/layouts',
  'src/constants',
  'src/types',
  'src/utils',
  'src/db',
  'src/lib',
  'src/router',
  'src/workers',
]
const SCAN_ROOTS = ['src', 'tests']
const SOURCE_EXTENSIONS = new Set(['.ts', '.vue'])
const DISALLOWED_IMPORT_PATTERNS = [
  /['"]@\/stores\//,
  /['"]@\/services\//,
  /['"]@\/commands(?:['"/])/,
  /['"]@\/components\//,
  /['"]@\/composables\//,
  /from\s+['"]@\/composables['"]/,
  /['"]@\/views\//,
  /['"]@\/layouts\//,
  /['"]@\/constants(?:['"/])/,
  /['"]@\/types(?:['"/])/,
  /['"]@\/utils\//,
  /['"]@\/db\//,
  /['"]@\/lib\//,
  /['"]@\/router(?:['"/])/,
  /['"]@\/workers\//,
]

function toRelative(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll('\\', '/')
}

async function exists(relativePath) {
  try {
    await access(path.join(ROOT_DIR, relativePath))
    return true
  }
  catch {
    return false
  }
}

async function collectSourceFiles(relativeRoot) {
  const root = path.join(ROOT_DIR, relativeRoot)
  if (!(await exists(relativeRoot))) {
    return []
  }

  const files = []

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }

      const extension = path.extname(entry.name)
      if (SOURCE_EXTENSIONS.has(extension)) {
        files.push(absolutePath)
      }
    }
  }

  await walk(root)
  return files
}

async function main() {
  const violations = []

  for (const legacyDir of LEGACY_DIRS) {
    if (await exists(legacyDir)) {
      violations.push(`${legacyDir} must be removed.`)
    }
  }

  for (const scanRoot of SCAN_ROOTS) {
    const sourceFiles = await collectSourceFiles(scanRoot)
    for (const filePath of sourceFiles) {
      const source = await readFile(filePath, 'utf8')
      const hasLegacyImport = DISALLOWED_IMPORT_PATTERNS.some((pattern) => pattern.test(source))
      if (hasLegacyImport) {
        violations.push(`${toRelative(filePath)} still imports a legacy wrapper alias.`)
      }
    }
  }

  if (violations.length > 0) {
    console.error('Legacy path validation failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('Legacy path validation passed (no legacy directories/imports found).')
}

main().catch((error) => {
  console.error('Failed to validate legacy wrappers:', error)
  process.exit(1)
})
