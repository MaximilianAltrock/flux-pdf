import { computed } from 'vue'
import { ROTATION_DELTA_DEGREES } from '@/constants'
import { useDocumentStore } from '@/stores/document'
import type { PageReference, SourceFile } from '@/types'
import type { LintResult, PreflightFix, ResizeFixTarget } from '@/types/linter'

const POINTS_PER_INCH = 72
const SIZE_TOLERANCE = 0.05
const ORIENTATION_DOMINANCE = 0.9
const HEAVY_PAGE_BYTES = 10 * 1024 * 1024
const LOW_QUALITY_BYTES = 40 * 1024
const LOW_QUALITY_DPI = 150
const SCAN_IMAGE_DOMINANCE = 0.7
const SCAN_IMAGE_FULL_COVERAGE = 0.9
const SCAN_TEXT_CHAR_THRESHOLD = 40

type DisplaySize = { width: number; height: number }
type Orientation = 'portrait' | 'landscape'

function normalizeRotation(rotation: number): number {
  const normalized = rotation % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function getDisplaySize(page: PageReference): DisplaySize | null {
  const width = page.targetDimensions?.width ?? page.width ?? 0
  const height = page.targetDimensions?.height ?? page.height ?? 0
  if (width <= 0 || height <= 0) return null

  const rotation = normalizeRotation(page.rotation ?? 0)
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width }
  }

  return { width, height }
}

function formatInches(points: number): string {
  return (points / POINTS_PER_INCH).toFixed(2)
}

function formatSizeLabel(width: number, height: number): string {
  return `${formatInches(width)} x ${formatInches(height)} in`
}

function getOrientation(display: DisplaySize): Orientation {
  return display.width >= display.height ? 'landscape' : 'portrait'
}

function buildSizeMismatchRule(pages: PageReference[]): LintResult[] {
  const entries = pages
    .map((page) => {
      const display = getDisplaySize(page)
      if (!display) return null
      const short = Math.min(display.width, display.height)
      const long = Math.max(display.width, display.height)
      const key = `${Math.round(short)}x${Math.round(long)}`
      return {
        pageId: page.id,
        display,
        short,
        long,
        key,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)

  if (entries.length < 2) return []

  const buckets = new Map<
    string,
    { count: number; sumShort: number; sumLong: number; pageIds: string[] }
  >()

  for (const entry of entries) {
    const bucket = buckets.get(entry.key) ?? {
      count: 0,
      sumShort: 0,
      sumLong: 0,
      pageIds: [],
    }
    bucket.count += 1
    bucket.sumShort += entry.short
    bucket.sumLong += entry.long
    bucket.pageIds.push(entry.pageId)
    buckets.set(entry.key, bucket)
  }

  let primaryKey: string | null = null
  let primaryBucket: { count: number; sumShort: number; sumLong: number; pageIds: string[] } | null =
    null

  for (const [key, bucket] of buckets) {
    if (!primaryBucket || bucket.count > primaryBucket.count) {
      primaryKey = key
      primaryBucket = bucket
    }
  }

  if (!primaryBucket || !primaryKey) return []

  const primaryShort = primaryBucket.sumShort / primaryBucket.count
  const primaryLong = primaryBucket.sumLong / primaryBucket.count

  const outliers = entries.filter((entry) => {
    const shortDiff = Math.abs(entry.short - primaryShort) / primaryShort
    const longDiff = Math.abs(entry.long - primaryLong) / primaryLong
    return shortDiff > SIZE_TOLERANCE || longDiff > SIZE_TOLERANCE
  })

  if (outliers.length === 0) return []

  const targets: ResizeFixTarget[] = outliers.map((entry) => {
    const isLandscape = entry.display.width > entry.display.height
    const width = isLandscape ? primaryLong : primaryShort
    const height = isLandscape ? primaryShort : primaryLong
    return {
      pageId: entry.pageId,
      targetDimensions: { width, height },
    }
  })

  const label = formatSizeLabel(primaryShort, primaryLong)
  const fix: PreflightFix = {
    id: 'resize',
    label: `Resize to ${label}`,
    targets,
  }

  return [
    {
      ruleId: 'size-mismatch',
      severity: 'warning',
      message: `${outliers.length} page${outliers.length === 1 ? '' : 's'} deviate from the majority size (${label}).`,
      pageIds: outliers.map((entry) => entry.pageId),
      fix,
    },
  ]
}

function buildOrientationRule(pages: PageReference[]): LintResult[] {
  const entries = pages
    .map((page) => {
      const display = getDisplaySize(page)
      if (!display) return null
      return {
        pageId: page.id,
        orientation: getOrientation(display),
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)

  if (entries.length < 2) return []

  const counts = entries.reduce(
    (acc, entry) => {
      acc[entry.orientation] += 1
      return acc
    },
    { portrait: 0, landscape: 0 } as Record<Orientation, number>,
  )

  const dominant =
    counts.portrait >= counts.landscape ? 'portrait' : 'landscape'
  const dominantCount = counts[dominant]
  const ratio = dominantCount / entries.length

  if (ratio < ORIENTATION_DOMINANCE) return []

  const outliers = entries.filter((entry) => entry.orientation !== dominant)
  if (outliers.length === 0) return []

  return [
    {
      ruleId: 'orientation-mismatch',
      severity: 'warning',
      message: `Mixed orientations detected. ${outliers.length} page${
        outliers.length === 1 ? '' : 's'
      } differ from the dominant ${dominant} layout.`,
      pageIds: outliers.map((entry) => entry.pageId),
      fix: {
        id: 'rotate',
        label: `Rotate to ${dominant}`,
        rotation: ROTATION_DELTA_DEGREES.RIGHT,
      },
    },
  ]
}

function buildResolutionRules(
  pages: PageReference[],
  sources: Map<string, SourceFile>,
): LintResult[] {
  const heavyPageIds: string[] = []
  const lowQualityPageIds: string[] = []

  for (const page of pages) {
    const source = sources.get(page.sourceFileId)
    if (!source) continue
    const avgSize = source.fileSize / Math.max(1, source.pageCount)

    if (avgSize > HEAVY_PAGE_BYTES) {
      heavyPageIds.push(page.id)
    }

    const metrics = source.pageMetaData?.[page.sourcePageIndex]
    const textChars = metrics?.textChars ?? 0
    const coverage = metrics?.dominantImageCoverage ?? 0
    const dpi = metrics?.dominantImageDpi
    const isImageDominant = coverage >= SCAN_IMAGE_DOMINANCE
    const isFullPageImage = coverage >= SCAN_IMAGE_FULL_COVERAGE
    const hasLowText = textChars <= SCAN_TEXT_CHAR_THRESHOLD
    const isScanLike = isImageDominant && (hasLowText || isFullPageImage)

    if (isScanLike) {
      if (typeof dpi === 'number') {
        if (dpi < LOW_QUALITY_DPI) lowQualityPageIds.push(page.id)
      } else if (avgSize < LOW_QUALITY_BYTES) {
        lowQualityPageIds.push(page.id)
      }
    } else if (!metrics && source.isImageSource && avgSize < LOW_QUALITY_BYTES) {
      lowQualityPageIds.push(page.id)
    }
  }

  const results: LintResult[] = []

  if (heavyPageIds.length > 0) {
    results.push({
      ruleId: 'heavy-pages',
      severity: 'warning',
      message: `Heavy pages detected (${heavyPageIds.length}). Printing may be slow.`,
      pageIds: heavyPageIds,
    })
  }

  if (lowQualityPageIds.length > 0) {
    results.push({
      ruleId: 'low-quality',
      severity: 'warning',
      message: `Potential low-quality scans detected (${lowQualityPageIds.length}).`,
      pageIds: lowQualityPageIds,
    })
  }

  return results
}

function buildMetadataRule(title: string): LintResult[] {
  const normalized = title.trim().toLowerCase()
  if (!normalized) {
    return [
      {
        ruleId: 'metadata-title',
        severity: 'warning',
        message: 'Document title is empty. Add metadata before exporting.',
        pageIds: [],
        fix: { id: 'edit-metadata', label: 'Edit metadata' },
      },
    ]
  }

  const genericTitles = new Set([
    'untitled',
    'untitled project',
    'document1.docx',
    'microsoft word - document1.docx',
  ])

  if (genericTitles.has(normalized)) {
    return [
      {
        ruleId: 'metadata-title',
        severity: 'warning',
        message: `Document title looks generic ("${title.trim()}"). Consider updating metadata.`,
        pageIds: [],
        fix: { id: 'edit-metadata', label: 'Edit metadata' },
      },
    ]
  }

  return []
}

export function usePreflight() {
  const store = useDocumentStore()

  const problems = computed<LintResult[]>(() => {
    const results: LintResult[] = []
    const pages = store.contentPages as PageReference[]

    if (pages.length > 0) {
      results.push(...buildSizeMismatchRule(pages))
      results.push(...buildOrientationRule(pages))
      results.push(...buildResolutionRules(pages, store.sources))
      results.push(...buildMetadataRule(store.metadata.title))
    }

    return results
  })

  const problemsByPageId = computed(() => {
    const map = new Map<string, LintResult[]>()
    for (const problem of problems.value) {
      for (const pageId of problem.pageIds) {
        const list = map.get(pageId) ?? []
        list.push(problem)
        map.set(pageId, list)
      }
    }
    return map
  })

  const problemCount = computed(() => problems.value.length)
  const isHealthy = computed(() => problemCount.value === 0)

  return {
    problems,
    problemsByPageId,
    problemCount,
    isHealthy,
  }
}
