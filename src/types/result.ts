export interface ResultError {
  message: string
  code?: string
  cause?: unknown
}

export type Result<T, E = ResultError> =
  | { ok: true; value: T }
  | { ok: false; error: E }
