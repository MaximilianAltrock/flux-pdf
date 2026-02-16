import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT_DIR = process.cwd()
const SRC_DIR = path.join(ROOT_DIR, 'src')

const SCRIPT_TAG_REGEX = /<script\b([^>]*)>/g
const STYLE_TAG_REGEX = /<style\b([^>]*)>/g
const SAME_ELEMENT_VIF_VFOR_REGEX = /<[^>]*(?:\bv-if=)[^>]*\bv-for=|<[^>]*(?:\bv-for=)[^>]*\bv-if=/

async function collectVueFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return collectVueFiles(fullPath)
      if (entry.isFile() && entry.name.endsWith('.vue')) return [fullPath]
      return []
    }),
  )
  return files.flat()
}

function hasAttribute(attrs, attrName) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\b${escaped}\\b`, 'i')
  return pattern.test(attrs)
}

function hasLangTs(attrs) {
  return /\blang\s*=\s*["']ts["']/i.test(attrs)
}

function toRelative(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll('\\', '/')
}

async function main() {
  const files = await collectVueFiles(SRC_DIR)
  const violations = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const filePath = toRelative(file)

    const scriptMatches = [...source.matchAll(SCRIPT_TAG_REGEX)]
    for (const match of scriptMatches) {
      const attrs = match[1] ?? ''
      if (!hasAttribute(attrs, 'setup')) {
        violations.push(`${filePath}: use <script setup> for Vue SFC scripts`)
      }
      if (!hasLangTs(attrs)) {
        violations.push(`${filePath}: use <script setup lang="ts">`)
      }
    }

    const styleMatches = [...source.matchAll(STYLE_TAG_REGEX)]
    for (const match of styleMatches) {
      const attrs = match[1] ?? ''
      const isScoped = hasAttribute(attrs, 'scoped')
      const isModule = hasAttribute(attrs, 'module')
      if (!isScoped && !isModule) {
        violations.push(`${filePath}: styles should be scoped or module-based by default`)
      }
    }

    if (SAME_ELEMENT_VIF_VFOR_REGEX.test(source)) {
      violations.push(`${filePath}: avoid v-if and v-for on the same element`)
    }
  }

  if (violations.length > 0) {
    console.error('Vue SFC convention validation failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log(`Vue SFC convention validation passed (${files.length} files scanned).`)
}

main().catch((error) => {
  console.error('Failed to validate Vue SFC conventions:', error)
  process.exit(1)
})
