import { afterEach, describe, expect, it, vi } from 'vitest'
import { schemaToGbnf } from './gbnf'
import { gbnfMatches } from './__fixtures__/gbnfMatcher'
import { OnDeviceProvider, IDLE_UNLOAD_MS } from './onDeviceProvider'
import { ON_DEVICE_MODELS, deviceWarnings, defaultModelId } from './models'
import { toolFallbackSchema } from '../providers/toolCalls'
import { NOTE_TASKS_SCHEMA } from '../prompts/noteTasks.v1'
// The native sides keep their own copy of the pinned list; compare the sources.
import rust from '../../../src-tauri/src/local_model.rs?raw'
import java from '../../../android/app/src/full/java/com/kairos/app/LocalModelPlugin.java?raw'
import type { GenOpts, JSONSchema, LocalGenerateRequest, LocalRuntime, LocalTokenEvent, ToolDef } from '../../types'

const opts: GenOpts = { maxTokens: 200, temperature: 0.2, thinking: false }

/** A router-style schema: enums, optional keys, a bounded array. */
const GLOBAL_INTENT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['pending', 'review', 'query', 'change', 'chitchat'] },
    period: { type: 'string', enum: ['day', 'week', 'month'] },
    since: { type: 'string', enum: ['day', 'week', 'month', 'any'] },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
  required: ['intent'],
}

describe('JSON schema → GBNF', () => {
  it('accepts exactly the JSON the schema allows', () => {
    const g = schemaToGbnf(GLOBAL_INTENT_SCHEMA)
    expect(gbnfMatches(g, '{"intent": "query", "since": "week", "tags": ["go", "db"]}')).toBe(true)
    expect(gbnfMatches(g, '{ "intent":"chitchat" }')).toBe(true)
    expect(gbnfMatches(g, '{"intent": "delete"}')).toBe(false) // not in the enum
    expect(gbnfMatches(g, '{"since": "week"}')).toBe(false) // required key missing
    expect(gbnfMatches(g, '{"intent": "query", "extra": 1}')).toBe(false)
    expect(gbnfMatches(g, '{"intent": "query", "tags": ["a","b","c","d","e","f"]}')).toBe(false) // maxItems 5
  })

  it('handles objects with only optional keys, nested arrays and open values', () => {
    const tools: ToolDef[] = [{ name: 'move_card', description: '', parameters: { type: 'object', properties: { cardId: { type: 'string' } }, required: ['cardId'] } }]
    const g = schemaToGbnf(toolFallbackSchema(tools))
    expect(gbnfMatches(g, '{"tool_calls": [{"name": "move_card", "arguments": {"cardId": "KAI-4", "n": [1, true, null]}}]}')).toBe(true)
    expect(gbnfMatches(g, '{"tool_calls": []}')).toBe(true)
    expect(gbnfMatches(g, '{"tool_calls": [{"name": "rm_rf", "arguments": {}}]}')).toBe(false)
    const optional: JSONSchema = { type: 'object', properties: { a: { type: 'integer' }, b: { type: 'boolean' } } }
    const go = schemaToGbnf(optional)
    for (const ok of ['{}', '{"a": 1}', '{"b": false}', '{"a": -3, "b": true}']) expect(gbnfMatches(go, ok)).toBe(true)
    expect(gbnfMatches(go, '{"b": true, "a": 1}')).toBe(false) // fixed key order keeps the grammar small
    expect(gbnfMatches(go, '{"a": 1.5}')).toBe(false)
  })

  it('compiles every schema the prompts use', () => {
    const g = schemaToGbnf(NOTE_TASKS_SCHEMA)
    expect(gbnfMatches(g, JSON.stringify({ tasks: [{ title: 'Draft notes', quote: 'Priya will draft the notes', due: '2026-10-09' }] }))).toBe(true)
    // Escaped quotes and \u escapes inside strings are valid; a raw newline is not.
    expect(gbnfMatches(g, '{"tasks": [{"title": "Say \\"hi\\" \\u00e9", "quote": "q"}]}')).toBe(true)
    expect(gbnfMatches(g, '{"tasks": [{"title": "two\nlines", "quote": "q"}]}')).toBe(false)
  })
})

/** A runtime that records calls and replies with scripted tokens. */
function fakeRuntime(replies: string[], opts: { available?: boolean } = {}) {
  const log: string[] = []
  const requests: LocalGenerateRequest[] = []
  const runtime: LocalRuntime = {
    available: async () => opts.available ?? true,
    load: async (path, ctx) => { log.push(`load ${path} ${ctx}`) },
    unload: async () => { log.push('unload') },
    abort: async () => { log.push('abort') },
    generate: async (req, onEvent: (e: LocalTokenEvent) => void) => {
      requests.push(req)
      const text = replies.shift() ?? ''
      for (let i = 0; i < text.length; i += 4) onEvent({ type: 'token', text: text.slice(i, i + 4) })
      onEvent({ type: 'done', promptTokens: 120, completionTokens: 30 })
    },
  }
  return { runtime, log, requests }
}

const provider = (r: LocalRuntime, background = false) =>
  new OnDeviceProvider(r, { modelPath: '/models/m.gguf', contextTokens: 8192, id: 'tauri-llama', isBackground: () => background })

afterEach(() => vi.useRealTimers())

describe('OnDeviceProvider', () => {
  it('loads lazily on first use, streams tokens, reports usage, unloads after 5 idle minutes', async () => {
    vi.useFakeTimers()
    const { runtime, log } = fakeRuntime(['Hello from MiniCPM.'])
    const p = provider(runtime)
    expect(log).toEqual([])
    let text = ''
    for await (const t of p.generate([{ role: 'user', content: 'Hi' }], opts)) text += t
    expect(text).toBe('Hello from MiniCPM.')
    expect(log).toEqual(['load /models/m.gguf 8192'])
    expect(p.lastUsage()).toEqual({ promptTokens: 120, completionTokens: 30 })
    expect(p.capabilities).toMatchObject({ location: 'on-device', nativeTools: false })
    await vi.advanceTimersByTimeAsync(IDLE_UNLOAD_MS)
    expect(log).toEqual(['load /models/m.gguf 8192', 'unload'])
  })

  it('constrains JSON with a grammar built from the schema', async () => {
    const { runtime, requests } = fakeRuntime(['{"intent": "pending"}'])
    expect(await provider(runtime).generateJSON([{ role: 'user', content: 'what is pending' }], GLOBAL_INTENT_SCHEMA, opts)).toEqual({ intent: 'pending' })
    expect(requests[0].grammar).toBe(schemaToGbnf(GLOBAL_INTENT_SCHEMA))
  })

  it('makes tool calls through the validated-JSON form', async () => {
    const tools: ToolDef[] = [{ name: 'move_card', description: 'Move', parameters: { type: 'object', properties: { cardId: { type: 'string' }, toColumn: { type: 'string' } }, required: ['cardId', 'toColumn'] } }]
    const { runtime, requests } = fakeRuntime(['{"tool_calls": [{"name": "move_card", "arguments": {"cardId": "KAI-4", "toColumn": "Done"}}]}'])
    expect(await provider(runtime).callTools([{ role: 'user', content: 'Move KAI-4' }], tools, opts)).toEqual([{ id: 'call_0', name: 'move_card', args: { cardId: 'KAI-4', toColumn: 'Done' } }])
    expect(requests[0].grammar).toContain('"\\"move_card\\""')
  })

  it('refuses to run in the background and when the build has no runtime', async () => {
    const { runtime, log } = fakeRuntime(['x'])
    await expect(provider(runtime, true).generate([{ role: 'user', content: 'x' }], opts)[Symbol.asyncIterator]().next()).rejects.toMatchObject({ kind: 'aborted' })
    expect(log).toEqual([])
    const none = fakeRuntime([], { available: false })
    await expect(provider(none.runtime).generateJSON([{ role: 'user', content: 'x' }], { type: 'object' }, opts)).rejects.toMatchObject({ kind: 'config' })
  })
})

describe('model catalog', () => {
  it('is the same pinned list in TypeScript, Rust and Android', () => {
    for (const m of ON_DEVICE_MODELS) {
      expect(m.url).toMatch(/^https:\/\/huggingface\.co\/openbmb\/MiniCPM5-[12]B-GGUF\/resolve\/[0-9a-f]{40}\//)
      for (const src of [rust, java]) {
        expect(src).toContain(m.id)
        expect(src).toContain(m.url)
        expect(src).toContain(m.sha256)
        expect(src.replace(/_/g, '')).toContain(String(m.sizeBytes))
      }
    }
  })

  it('defaults to 1B on Android and 2B on desktop, and warns on low memory or storage', () => {
    expect(defaultModelId(true)).toBe('minicpm5-1b-q4km')
    expect(defaultModelId(false)).toBe('minicpm5-2b-q4km')
    const twoB = ON_DEVICE_MODELS[1]
    expect(deviceWarnings(twoB, { totalRam: 16e9, availableRam: 8e9, freeDisk: 50e9 })).toEqual([])
    const w = deviceWarnings(twoB, { totalRam: 4e9, availableRam: 2e9, freeDisk: 1.8e9 })
    expect(w).toHaveLength(2)
    expect(w[1]).toMatch(/model plus 500 MB/)
  })
})
