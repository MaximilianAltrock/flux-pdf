/**
 * Parse a page range string into an array of 0-based indices.
 * e.g., "1-5, 8, 10-12" => [0, 1, 2, 3, 4, 7, 9, 10, 11]
 */
export function parsePageRange(rangeStr: string, maxPages: number): number[] {
  const indices: Set<number> = new Set()

  const parts = rangeStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim())
      if (!startStr || !endStr) continue
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
          indices.add(i - 1)
        }
      }
    } else {
      const pageNum = parseInt(part, 10)
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
        indices.add(pageNum - 1)
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Validate a page range string.
 */
export function validatePageRange(
  rangeStr: string,
  maxPages: number,
): { valid: boolean; error?: string } {
  if (!rangeStr.trim()) {
    return { valid: false, error: 'Page range is required' }
  }

  const indices = parsePageRange(rangeStr, maxPages)

  if (indices.length === 0) {
    return { valid: false, error: 'No valid pages in range' }
  }

  return { valid: true }
}
