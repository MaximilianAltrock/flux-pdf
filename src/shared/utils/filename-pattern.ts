export interface FilenamePatternContext {
  originalName: string
  name?: string
  date?: Date | string
  version?: number | string
}

const TOKEN_REGEX = /\{(original_name|name|date|version)\}/gi
const INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*]|\p{Cc}/gu

function toDateToken(value?: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  return new Date().toISOString().slice(0, 10)
}

function sanitizeFilenameBase(value: string): string {
  return value
    .replace(INVALID_FILENAME_CHARS_REGEX, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim()
}

export function stripPdfExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, '')
}

export function formatFilenamePattern(
  pattern: string,
  context: FilenamePatternContext,
): string {
  const baseOriginalName = sanitizeFilenameBase(stripPdfExtension(context.originalName))
  const baseName = sanitizeFilenameBase(context.name ?? baseOriginalName)
  const resolvedName = baseName || baseOriginalName || 'document'
  const resolvedOriginalName = baseOriginalName || resolvedName
  const resolvedVersion = String(context.version ?? 1)
  const resolvedDate = toDateToken(context.date)
  const normalizedPattern = pattern.trim() || '{name}_v{version}'

  const rendered = normalizedPattern.replace(TOKEN_REGEX, (_, token: string) => {
    const normalizedToken = token.toLowerCase()

    if (normalizedToken === 'original_name') return resolvedOriginalName
    if (normalizedToken === 'name') return resolvedName
    if (normalizedToken === 'date') return resolvedDate
    if (normalizedToken === 'version') return resolvedVersion
    return ''
  })

  const sanitized = sanitizeFilenameBase(rendered)
  return sanitized || resolvedName
}
