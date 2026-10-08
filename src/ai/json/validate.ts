/**
 * Validator for the JSON Schema subset in `JSONSchema` (types, properties,
 * required, additionalProperties, items, enum, length/size bounds). Small on
 * purpose — the agent only needs these keywords, and errors are written to be
 * appended to a retry prompt.
 */
import type { JSONSchema } from '../../types'

export type ValidationResult = { ok: true } | { ok: false; errors: string[] }

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function matchesType(v: unknown, type: NonNullable<JSONSchema['type']>): boolean {
  const actual = typeOf(v)
  if (type === 'number') return actual === 'number' || actual === 'integer'
  return actual === type
}

function check(value: unknown, schema: JSONSchema, path: string, errors: string[]): void {
  const at = path || '(root)'
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${at}: expected ${schema.type}, got ${typeOf(value)}`)
    return
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    errors.push(`${at}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`)
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength}`)
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${at}: longer than ${schema.maxLength}`)
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: below minimum ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: above maximum ${schema.maximum}`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: fewer than ${schema.minItems} items`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at}: more than ${schema.maxItems} items`)
    if (schema.items) value.forEach((item, i) => check(item, schema.items!, `${path}[${i}]`, errors))
  }
  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${path ? path + '.' : ''}${key}: required`)
    }
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties?.[key]
      if (sub) check(v, sub, path ? `${path}.${key}` : key, errors)
      else if (schema.additionalProperties === false) errors.push(`${path ? path + '.' : ''}${key}: not allowed`)
    }
  }
}

export function validateJSON(value: unknown, schema: JSONSchema): ValidationResult {
  const errors: string[] = []
  check(value, schema, '', errors)
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

/** Parses model output that should be JSON, tolerating ```json fences and
 *  leading/trailing prose around a single object or array. */
export function extractJSON(text: string): unknown {
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) } catch { /* fall through */ }
  }
  const start = trimmed.search(/[{[]/)
  if (start !== -1) {
    const close = trimmed[start] === '{' ? '}' : ']'
    const end = trimmed.lastIndexOf(close)
    if (end > start) return JSON.parse(trimmed.slice(start, end + 1))
  }
  throw new SyntaxError('No JSON found in the model output')
}
