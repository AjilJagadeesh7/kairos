import { describe, it, expect } from 'vitest'
import { validateJSON, extractJSON } from './validate'
import type { JSONSchema } from '../../types'

const card: JSONSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 20 },
    column: { type: 'string', enum: ['To Do', 'Done'] },
    points: { type: 'integer', minimum: 0, maximum: 13 },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 2 },
  },
  required: ['title', 'column'],
  additionalProperties: false,
}

describe('validateJSON', () => {
  it('accepts a valid value', () => {
    expect(validateJSON({ title: 'Fix login', column: 'Done', points: 3, tags: ['bug'] }, card)).toEqual({ ok: true })
  })

  it('reports every problem with a path', () => {
    const r = validateJSON({ column: 'Doing', points: 2.5, tags: ['a', 'b', 3], extra: true }, card)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toEqual(expect.arrayContaining([
      'title: required',
      'column: must be one of "To Do", "Done"',
      'points: expected integer, got number',
      'tags: more than 2 items',
      'tags[2]: expected string, got integer',
      'extra: not allowed',
    ]))
  })

  it('treats integers as numbers but not the reverse', () => {
    expect(validateJSON(3, { type: 'number' }).ok).toBe(true)
    expect(validateJSON(3.5, { type: 'integer' }).ok).toBe(false)
  })

  it('distinguishes null, arrays and objects', () => {
    expect(validateJSON(null, { type: 'object' }).ok).toBe(false)
    expect(validateJSON([], { type: 'object' }).ok).toBe(false)
    expect(validateJSON({}, { type: 'object' }).ok).toBe(true)
  })
})

describe('extractJSON', () => {
  it('parses bare, fenced and prose-wrapped JSON', () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 })
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJSON('Sure! Here it is: {"a":[1,2]} Hope that helps.')).toEqual({ a: [1, 2] })
    expect(extractJSON('[1,2]')).toEqual([1, 2])
  })

  it('throws when there is no JSON', () => {
    expect(() => extractJSON('no idea')).toThrow()
  })
})
