import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const MATRIX_PATH = path.join('docs', 'refactor', 'domain-layer-matrix.json')

function getDuplicateValues(values) {
  const counts = new Map()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
}

async function readJson(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath)
  const raw = await readFile(absolutePath, 'utf8')
  return JSON.parse(raw)
}

async function readDirectoryNames(absolutePath) {
  const entries = await readdir(absolutePath, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function normalizeLayerList(value) {
  if (!Array.isArray(value)) return []
  return value.filter((item) => typeof item === 'string')
}

async function main() {
  const matrix = await readJson(MATRIX_PATH)
  const root = matrix.domainsRoot
  const allowedLayers = new Set(normalizeLayerList(matrix.allowedLayers))
  const domains = matrix.domains ?? {}
  const expectedDomainNames = Object.keys(domains).sort()
  const violations = []

  if (typeof root !== 'string' || root.trim().length === 0) {
    violations.push('Matrix requires a non-empty "domainsRoot" string.')
  }

  if (allowedLayers.size === 0) {
    violations.push('Matrix requires at least one allowed layer in "allowedLayers".')
  }

  if (expectedDomainNames.length === 0) {
    violations.push('Matrix requires at least one domain entry in "domains".')
  }

  if (violations.length > 0) {
    console.error('Domain layer matrix validation failed.')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  const domainsRoot = path.join(process.cwd(), root)
  const actualDomainNames = await readDirectoryNames(domainsRoot)

  const missingDomains = expectedDomainNames.filter((domain) => !actualDomainNames.includes(domain))
  const unexpectedDomains = actualDomainNames.filter(
    (domain) => !expectedDomainNames.includes(domain),
  )

  for (const domain of missingDomains) {
    violations.push(`Missing domain directory: ${path.join(root, domain)}`)
  }

  for (const domain of unexpectedDomains) {
    violations.push(`Domain directory missing from matrix: ${path.join(root, domain)}`)
  }

  for (const domain of expectedDomainNames) {
    const config = domains[domain] ?? {}
    const required = normalizeLayerList(config.required)
    const optional = normalizeLayerList(config.optional)
    const deferred = normalizeLayerList(config.deferred)
    const declaredLayers = [...required, ...optional, ...deferred]

    const duplicateLayers = getDuplicateValues(declaredLayers)
    if (duplicateLayers.length > 0) {
      violations.push(
        `Domain "${domain}" has duplicate layer declarations: ${duplicateLayers.join(', ')}`,
      )
    }

    const unknownDeclaredLayers = declaredLayers.filter((layer) => !allowedLayers.has(layer))
    if (unknownDeclaredLayers.length > 0) {
      violations.push(
        `Domain "${domain}" declares unknown layers: ${unknownDeclaredLayers.join(', ')}`,
      )
    }

    const domainPath = path.join(domainsRoot, domain)
    if (!actualDomainNames.includes(domain)) continue

    const actualLayers = await readDirectoryNames(domainPath)
    const missingRequiredLayers = required.filter((layer) => !actualLayers.includes(layer))
    const unknownActualLayers = actualLayers.filter((layer) => !allowedLayers.has(layer))

    if (missingRequiredLayers.length > 0) {
      violations.push(
        `Domain "${domain}" is missing required layers: ${missingRequiredLayers.join(', ')}`,
      )
    }

    if (unknownActualLayers.length > 0) {
      violations.push(
        `Domain "${domain}" contains layers outside allowed set: ${unknownActualLayers.join(', ')}`,
      )
    }
  }

  if (violations.length > 0) {
    console.error('Domain layer matrix validation failed.')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log(
    `Domain layer matrix validation passed (${expectedDomainNames.length} domains, matrix: ${MATRIX_PATH}).`,
  )
}

main().catch((error) => {
  console.error('Failed to validate domain layer matrix:', error)
  process.exit(1)
})
