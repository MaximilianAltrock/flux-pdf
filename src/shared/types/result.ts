export interface ResultError {
  message: string
  code?: string
  cause?: unknown
}

export type ResultOk<T> = { ok: true; value: T }
export type ResultErr<E extends ResultError = ResultError> = { ok: false; error: E }
export type Result<T, E extends ResultError = ResultError> = ResultOk<T> | ResultErr<E>

export function ok<T>(value: T): ResultOk<T> {
  return { ok: true, value }
}

export function err<E extends ResultError>(error: E): ResultErr<E> {
  return { ok: false, error }
}
