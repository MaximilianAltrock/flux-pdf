const APPLE_PLATFORM_PATTERN = /Mac|iPhone|iPad|iPod/i

export function getPrimaryModifierLabel(): 'Cmd' | 'Ctrl' {
  if (typeof navigator === 'undefined') return 'Ctrl'

  const platform = navigator.platform || navigator.userAgent || ''
  return APPLE_PLATFORM_PATTERN.test(platform) ? 'Cmd' : 'Ctrl'
}

export function withPrimaryModifier(key: string): string {
  return `${getPrimaryModifierLabel()}+${key}`
}
