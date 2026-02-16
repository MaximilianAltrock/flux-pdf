import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOTS = ['src/domains', 'src/shared/components', 'src/app']
const EXCLUDED_PREFIX = path.normalize('src/shared/components/ui')

const OVERLAY_TAG_REQUIREMENTS = [
  {
    contentTag: 'DialogContent',
    titleTag: 'DialogTitle',
    descriptionTag: 'DialogDescription',
  },
  {
    contentTag: 'DrawerContent',
    titleTag: 'DrawerTitle',
    descriptionTag: 'DrawerDescription',
    alternativeSemanticTags: ['MobileDrawerHeader'],
  },
  {
    contentTag: 'SheetContent',
    titleTag: 'SheetTitle',
    descriptionTag: 'SheetDescription',
  },
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toKebabCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function buildTagRegex(tagName) {
  return new RegExp(`<\\s*${escapeRegExp(tagName)}(?=[\\s>/])`)
}

function hasTag(sourceText, pascalTagName) {
  const kebabTagName = toKebabCase(pascalTagName)
  return buildTagRegex(pascalTagName).test(sourceText) || buildTagRegex(kebabTagName).test(sourceText)
}

async function collectVueFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        return collectVueFiles(entryPath)
      }
      if (entry.isFile() && entry.name.endsWith('.vue')) {
        return [entryPath]
      }
      return []
    }),
  )
  return files.flat()
}

async function main() {
  const cwd = process.cwd()
  const vueFileLists = await Promise.all(ROOTS.map((root) => collectVueFiles(path.join(cwd, root))))
  const allVueFiles = vueFileLists.flat()
  const errors = []

  for (const absoluteFilePath of allVueFiles) {
    const relativeFilePath = path.relative(cwd, absoluteFilePath)
    const normalizedRelativePath = path.normalize(relativeFilePath)
    if (normalizedRelativePath.startsWith(`${EXCLUDED_PREFIX}${path.sep}`)) {
      continue
    }

    const fileText = await readFile(absoluteFilePath, 'utf8')

    for (const requirement of OVERLAY_TAG_REQUIREMENTS) {
      const hasContentTag = hasTag(fileText, requirement.contentTag)
      if (!hasContentTag) continue

      const hasTitleTag = hasTag(fileText, requirement.titleTag)
      const hasDescriptionTag = hasTag(fileText, requirement.descriptionTag)
      const hasAlternativeSemantics = (requirement.alternativeSemanticTags ?? []).some((tagName) =>
        hasTag(fileText, tagName),
      )
      if ((hasTitleTag && hasDescriptionTag) || hasAlternativeSemantics) continue

      errors.push({
        filePath: relativeFilePath,
        contentTag: requirement.contentTag,
        hasTitleTag,
        hasDescriptionTag,
      })
    }
  }

  if (errors.length > 0) {
    console.error('Overlay accessibility validation failed.\n')
    for (const error of errors) {
      const missingTags = []
      if (!error.hasTitleTag) {
        missingTags.push(
          `${error.contentTag.replace('Content', 'Title')} (or ${toKebabCase(error.contentTag.replace('Content', 'Title'))})`,
        )
      }
      if (!error.hasDescriptionTag) {
        missingTags.push(
          `${error.contentTag.replace('Content', 'Description')} (or ${toKebabCase(error.contentTag.replace('Content', 'Description'))})`,
        )
      }
      console.error(`- ${error.filePath}`)
      console.error(`  Missing: ${missingTags.join(', ')}`)
    }
    process.exit(1)
  }

  console.log(`Overlay accessibility validation passed (${allVueFiles.length} files scanned).`)
}

await main()
