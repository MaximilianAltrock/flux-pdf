export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

function logWithPrefix(method: 'debug' | 'info' | 'warn' | 'error', scope: string, args: unknown[]) {
  const prefix = `[flux-pdf:${scope}]`
  console[method](prefix, ...args)
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...args) => logWithPrefix('debug', scope, args),
    info: (...args) => logWithPrefix('info', scope, args),
    warn: (...args) => logWithPrefix('warn', scope, args),
    error: (...args) => logWithPrefix('error', scope, args),
  }
}

export const logger = createLogger('app')
