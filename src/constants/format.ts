export const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] as const

export const BYTES_PER_KB = 1024
export const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB

export const FORMAT_BYTES_DECIMALS_DEFAULT = 2
export const FORMAT_BYTES_DECIMALS_MIN = 0
export const FORMAT_FILE_SIZE_DECIMALS = 1
