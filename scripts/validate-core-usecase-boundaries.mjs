import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT_DIR = process.cwd()
const EDITOR_APP_DIR = path.join(ROOT_DIR, 'src', 'domains', 'editor', 'application')

const RULES = [
  {
    file: path.join('src', 'domains', 'editor', 'application', 'actions', 'file-export-actions.ts'),
    required: [
      {
        pattern: /\bimportPdfUseCase\s*\(/,
        message: 'import flow must call importPdf use-case',
      },
      {
        pattern: /\bexportPdfUseCase\s*\(/,
        message: 'export flow must call exportPdf use-case',
      },
    ],
    forbidden: [
      {
        pattern: /\bservices\.importFiles\s*\(/,
        message: 'import flow must not call document service importFiles directly',
      },
      {
        pattern: /\bservices\.exportDocument\s*\(/,
        message: 'export flow must not call document service exportDocument directly',
      },
    ],
  },
  {
    file: path.join('src', 'domains', 'editor', 'application', 'actions', 'page-actions.ts'),
    required: [
      {
        pattern: /\breorderPagesUseCase\s*\(/,
        message: 'reorder flow must call reorderPages use-case',
      },
    ],
  },
  {
    file: path.join('src', 'domains', 'editor', 'application', 'actions', 'metadata-actions.ts'),
    required: [
      {
        pattern: /\bupdateMetadataUseCase\s*\(/,
        message: 'metadata flow must call updateMetadata use-case',
      },
    ],
    forbidden: [
      {
        pattern: /\bstore\.setMetadata\s*\(/,
        message: 'metadata flow must not call store.setMetadata directly',
      },
    ],
  },
]

const DISALLOWED_EDITOR_PATTERNS = [
  {
    pattern: /['"]@\/domains\/history\/domain\/commands(?:['"/])/,
    message: 'editor application must not import history command classes directly',
  },
  {
    pattern: /\bnew\s+[A-Za-z][A-Za-z0-9]*Command\s*\(/,
    message: 'editor application must not instantiate command classes directly',
  },
]

function toRelative(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll('\\', '/')
}

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return collectTypeScriptFiles(fullPath)
      if (entry.isFile() && entry.name.endsWith('.ts')) return [fullPath]
      return []
    }),
  )
  return files.flat()
}

async function main() {
  const violations = []

  for (const rule of RULES) {
    const absolutePath = path.join(ROOT_DIR, rule.file)
    let source = ''
    try {
      source = await readFile(absolutePath, 'utf8')
    } catch (error) {
      violations.push(`${rule.file}: unable to read file (${error instanceof Error ? error.message : 'unknown error'})`)
      continue
    }

    for (const required of rule.required ?? []) {
      if (!required.pattern.test(source)) {
        violations.push(`${rule.file}: ${required.message}`)
      }
    }

    for (const forbidden of rule.forbidden ?? []) {
      if (forbidden.pattern.test(source)) {
        violations.push(`${rule.file}: ${forbidden.message}`)
      }
    }
  }

  const editorFiles = await collectTypeScriptFiles(EDITOR_APP_DIR)
  for (const filePath of editorFiles) {
    const source = await readFile(filePath, 'utf8')
    for (const rule of DISALLOWED_EDITOR_PATTERNS) {
      if (rule.pattern.test(source)) {
        violations.push(`${toRelative(filePath)}: ${rule.message}`)
      }
    }
  }

  if (violations.length > 0) {
    console.error('Core use-case boundary validation failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('Core use-case boundary validation passed (editor workflows route through use-cases).')
}

main().catch((error) => {
  console.error('Failed to validate core use-case boundaries:', error)
  process.exit(1)
})
