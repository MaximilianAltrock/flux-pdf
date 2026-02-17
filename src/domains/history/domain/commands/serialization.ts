import type { SerializedCommand } from './types'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function assertJsonSafeValue(value: unknown, path: string): void {
  if (value === null) return

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'boolean') return

  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} must be a finite number.`)
    }
    return
  }

  if (
    valueType === 'undefined' ||
    valueType === 'function' ||
    valueType === 'symbol' ||
    valueType === 'bigint'
  ) {
    throw new Error(`${path} contains unsupported JSON value type "${valueType}".`)
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      assertJsonSafeValue(value[i], `${path}[${i}]`)
    }
    return
  }

  if (value instanceof Date) {
    throw new Error(`${path} contains Date. Encode it to string/number first.`)
  }

  if (value instanceof Map || value instanceof Set) {
    throw new Error(`${path} contains Map/Set. Encode it as plain objects/arrays first.`)
  }

  if (value instanceof RegExp) {
    throw new Error(`${path} contains RegExp. Encode it as a string first.`)
  }

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    throw new Error(`${path} contains binary data. Encode it before persistence.`)
  }

  if (!isPlainRecord(value)) {
    throw new Error(`${path} contains non-plain object instances.`)
  }

  for (const [key, nested] of Object.entries(value)) {
    assertJsonSafeValue(nested, `${path}.${key}`)
  }
}

function assertSerializedCommandShape(serialized: SerializedCommand): void {
  if (!serialized.type || typeof serialized.type !== 'string') {
    throw new Error('Serialized command "type" must be a non-empty string.')
  }

  if (!Number.isFinite(serialized.timestamp)) {
    throw new Error('Serialized command "timestamp" must be a finite number.')
  }

  if (!isPlainRecord(serialized.payload)) {
    throw new Error('Serialized command "payload" must be a plain object.')
  }

  if (typeof serialized.payload.id !== 'string' || serialized.payload.id.length === 0) {
    throw new Error('Serialized command "payload.id" must be a non-empty string.')
  }

  assertJsonSafeValue(serialized.payload, 'payload')
}

export function toJsonSafeSerializedCommand(serialized: SerializedCommand): SerializedCommand {
  assertSerializedCommandShape(serialized)
  return JSON.parse(JSON.stringify(serialized)) as SerializedCommand
}
