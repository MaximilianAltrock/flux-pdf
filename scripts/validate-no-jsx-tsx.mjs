import { readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT_DIR = process.cwd()
const SRC_DIR = path.join(ROOT_DIR, 'src')
const DISALLOWED_EXTENSIONS = new Set(['.jsx', '.tsx'])

async function collectDisallowedFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const matches = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return collectDisallowedFiles(fullPath)
      if (entry.isFile() && DISALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
        return [fullPath]
      }
      return []
    }),
  )
  return matches.flat()
}

function toRelative(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll('\\', '/')
}

async function main() {
  const files = await collectDisallowedFiles(SRC_DIR)
  if (files.length > 0) {
    console.error('JSX/TSX files are currently disallowed in src/.')
    for (const file of files) {
      console.error(`- ${toRelative(file)}`)
    }
    process.exit(1)
  }
  console.log('JSX/TSX validation passed (no JSX/TSX files found).')
}

main().catch((error) => {
  console.error('Failed to validate JSX/TSX usage:', error)
  process.exit(1)
})
