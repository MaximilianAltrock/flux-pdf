import {
  BYTE_UNITS,
  BYTES_PER_KB,
  BYTES_PER_MB,
  FORMAT_BYTES_DECIMALS_DEFAULT,
  FORMAT_BYTES_DECIMALS_MIN,
  FORMAT_FILE_SIZE_DECIMALS,
} from '@/shared/constants'

/**
 * Formats a size in bytes to a human-readable string using binary prefixes (KiB, MiB).
 *
 * @param bytes - The size in bytes
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted string (e.g., "1.29 MB")
 */
export function formatBytes(
  bytes: number,
  decimals: number = FORMAT_BYTES_DECIMALS_DEFAULT,
): string {
  if (bytes === 0) return '0 B'
  if (bytes < 0) return '0 B'

  const k = BYTES_PER_KB
  const dm = decimals < FORMAT_BYTES_DECIMALS_MIN ? FORMAT_BYTES_DECIMALS_MIN : decimals
  const sizes = BYTE_UNITS

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`
  if (bytes < BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_KB).toFixed(FORMAT_FILE_SIZE_DECIMALS)} KB`
  }
  return `${(bytes / BYTES_PER_MB).toFixed(FORMAT_FILE_SIZE_DECIMALS)} MB`
}

export function formatTime(timestamp: number, includeSeconds = false): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
  })
}
