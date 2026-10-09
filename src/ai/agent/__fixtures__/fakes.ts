/** Test doubles for the note-bubble runners: a scripted provider, editor and sink. */
import type {
  BubbleEnv, BubbleMessage, Condensed, EditorRange, GenOpts, JSONSchema, LLMProvider, Msg,
  NoteEditorBridge, NoteSnapshot, ToolCall, ToolDef,
} from '../../../types'

export interface FakeCall { kind: 'generate' | 'json' | 'tools'; messages: Msg[]; opts: GenOpts; schema?: JSONSchema; tools?: ToolDef[] }

export function fakeProvider(script: {
  generate?: (messages: Msg[], call: number) => string
  json?: (messages: Msg[], schema: JSONSchema) => unknown
  tools?: (messages: Msg[], tools: ToolDef[]) => Array<Omit<ToolCall, 'id'>>
}) {
  const calls: FakeCall[] = []
  let generated = 0
  const provider: LLMProvider = {
    id: 'openai-compat',
    capabilities: { nativeTools: false, jsonSchema: true, contextTokens: 8000, embeddings: false, location: 'self-hosted' },
    isAvailable: async () => true,
    async *generate(messages: Msg[], opts: GenOpts) {
      calls.push({ kind: 'generate', messages, opts })
      const text = script.generate?.(messages, generated++) ?? ''
      // Stream in a few pieces, like a server would.
      for (let i = 0; i < text.length; i += 7) yield text.slice(i, i + 7)
    },
    async generateJSON<T>(messages: Msg[], schema: JSONSchema, opts: GenOpts): Promise<T> {
      calls.push({ kind: 'json', messages, opts, schema })
      return script.json?.(messages, schema) as T
    },
    async callTools(messages: Msg[], tools: ToolDef[], opts: GenOpts): Promise<ToolCall[]> {
      calls.push({ kind: 'tools', messages, opts, tools })
      return (script.tools?.(messages, tools) ?? []).map((c, i) => ({ id: `call_${i}`, ...c }))
    },
    abort: () => {},
    lastUsage: () => null,
  }
  return { provider, calls }
}

export function fakeBridge(selection: { markdown: string; from?: number; to?: number } | null = null) {
  const state = {
    preview: null as null | { range: EditorRange; originalText: string; proposed: string },
    applied: [] as string[],
    insertedAtTop: [] as string[],
  }
  const bridge: NoteEditorBridge = {
    markdown: () => null,
    selection: () => selection && {
      from: selection.from ?? 10, to: selection.to ?? 10 + selection.markdown.length,
      markdown: selection.markdown, text: selection.markdown,
    },
    continuePoint: (pos) => ({ pos: pos ?? 500, before: 'Earlier text of the note.' }),
    document: () => ({ from: 0, to: 900, markdown: '# Whole note\n\nAll of it.', text: 'Whole note All of it.' }),
    edgePoint: (at) => (at === 'top' ? { pos: 0, before: '' } : { pos: 900, before: 'Earlier text of the note.' }),
    showPreview: (range, originalText, proposed) => { state.preview = { range, originalText, proposed } },
    clearPreview: () => { state.preview = null },
    previewRange: () => state.preview?.range ?? null,
    applyPreview: (md) => {
      if (!state.preview) return 'missing'
      state.applied.push(md)
      state.preview = null
      return 'ok'
    },
    insertAtTop: (md) => { state.insertedAtTop.push(md); return true },
  }
  return { bridge, state }
}

export function fakeEnv(provider: LLMProvider, note: Partial<NoteSnapshot>, opts: {
  bridge?: NoteEditorBridge; budget?: number; history?: Msg[]; vocabulary?: string[]; attached?: string
} = {}) {
  const messages: BubbleMessage[] = []
  const progress: string[] = []
  let stopped = false
  const env: BubbleEnv = {
    provider,
    budget: opts.budget ?? 8000,
    note: () => ({ id: 'n1', title: 'Test note', content: '', tags: [], updatedAt: '2026-10-01T10:00:00Z', ...note }),
    vocabulary: opts.vocabulary ?? [],
    bridge: opts.bridge ?? fakeBridge().bridge,
    sink: {
      add: (m) => { messages.push(m) },
      patch: (id, update) => {
        const i = messages.findIndex((m) => m.id === id)
        if (i !== -1) messages[i] = update(messages[i])
      },
      progress: (t) => { if (t) progress.push(t) },
    },
    isStopped: () => stopped,
    history: () => opts.history ?? [],
    cache: new Map<string, Condensed>(),
    attachedContext: async () => opts.attached ?? null,
  }
  return { env, messages, progress, stop: () => { stopped = true } }
}

/** A long markdown note with numbered, findable sections. */
export function longNote(sections: number, wordsPerSection = 400): string {
  const out: string[] = []
  for (let s = 1; s <= sections; s++) {
    out.push(`## Section ${s}`)
    const words: string[] = []
    for (let w = 0; w < wordsPerSection; w++) words.push(w === 0 ? `MARKER${s}` : `word${w % 50}`)
    out.push(words.join(' ') + '.')
  }
  return out.join('\n\n')
}
