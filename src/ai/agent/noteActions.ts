/**
 * Note-bubble actions that read the whole page: summarize, suggest a title or
 * tags, answer a question — plus routing a free-text message to one of them.
 */
import { computeNoteFacts, factsHeader, factsJSON } from './noteFacts'
import { fitTurns, messagesTokens, usableBudget } from './budget'
import { routeNoteIntent } from './noteIntent'
import { runContinue, runRewrite } from './noteWriting'
import {
  questionMessages, summarizeMessages, tagsMessages, titleMessages,
} from '../prompts/noteBubble.v1'
import { GEN, condensedMeta, fitPage, newMessage, notice, streamInto } from './bubbleEnv'
import type { BubbleEnv, JSONSchema } from '../../types'

export async function runSummarize(env: BubbleEnv): Promise<void> {
  const note = env.note()
  const facts = computeNoteFacts(note)
  const factsText = factsJSON(facts)
  const msg = newMessage({ role: 'assistant', content: '', action: 'summarize', streaming: true, meta: factsHeader(facts) })
  env.sink.add(msg)

  const page = await fitPage(env, messagesTokens(summarizeMessages(note.title, '', false, factsText)))
  const extra = condensedMeta(page)
  if (extra) env.sink.patch(msg.id, (m) => ({ ...m, meta: `${m.meta} · ${extra}` }))

  const { text, stopped } = await streamInto(env, msg.id, summarizeMessages(note.title, page.text, page.condensed, factsText), GEN.summary)
  env.sink.patch(msg.id, (m) => ({
    ...m,
    content: text.trim(),
    meta: stopped ? `${m.meta} · Stopped` : m.meta,
    suggestion: !stopped && text.trim() ? { kind: 'summary', inserted: false } : undefined,
  }))
}

/** A summary as a note callout, for "Insert at top". */
export function summaryCallout(summary: string): string {
  const body = summary.trim().split('\n').map((l) => (l.trim() ? `> ${l}` : '>')).join('\n')
  return `> [!NOTE] Summary\n>\n${body}\n`
}

const TITLES_SCHEMA: JSONSchema = {
  type: 'object',
  properties: { titles: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 120 }, minItems: 1, maxItems: 3 } },
  required: ['titles'],
  additionalProperties: false,
}

export function cleanTitle(raw: string): string {
  return raw.trim().replace(/^["“'#\s]+|["”'\s]+$/g, '').replace(/\.$/, '').slice(0, 120)
}

export async function runSuggestTitle(env: BubbleEnv): Promise<void> {
  const note = env.note()
  const page = await fitPage(env, messagesTokens(titleMessages(note.title, '', false)))
  const out = await env.provider.generateJSON<{ titles: string[] }>(
    titleMessages(note.title, page.text, page.condensed), TITLES_SCHEMA, GEN.json)
  const current = note.title.trim().toLowerCase()
  const options = [...new Set(out.titles.map(cleanTitle))].filter((t) => t && t.toLowerCase() !== current)
  if (!options.length) { notice(env, 'No new title ideas — the current title already fits.'); return }
  env.sink.add(newMessage({
    role: 'assistant', content: 'Title ideas:', action: 'suggest_title', meta: condensedMeta(page) || undefined,
    suggestion: { kind: 'title', options, applied: null },
  }))
}

const TAGS_SCHEMA: JSONSchema = {
  type: 'object',
  properties: { tags: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 40 }, maxItems: 8 } },
  required: ['tags'],
  additionalProperties: false,
}

/** "#Project Alpha" → "project-alpha". */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase()
    .replace(/[\s_]+/g, '-').replace(/[^\p{L}\p{N}/-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export async function runSuggestTags(env: BubbleEnv): Promise<void> {
  const note = env.note()
  const vocabulary = env.vocabulary.slice(0, 150)
  const page = await fitPage(env, messagesTokens(tagsMessages(note.title, '', false, note.tags, vocabulary)))
  const out = await env.provider.generateJSON<{ tags: string[] }>(
    tagsMessages(note.title, page.text, page.condensed, note.tags, vocabulary), TAGS_SCHEMA, GEN.json)
  const have = new Set(note.tags.map((t) => t.toLowerCase()))
  const options = [...new Set(out.tags.map(normalizeTag))].filter((t) => t && !have.has(t)).slice(0, 5)
  if (!options.length) { notice(env, 'No new tags to suggest — the current tags already cover this note.'); return }
  env.sink.add(newMessage({
    role: 'assistant', content: 'Tag ideas — pick the ones to add:', action: 'suggest_tags', meta: condensedMeta(page) || undefined,
    suggestion: { kind: 'tags', options, applied: null },
  }))
}

export async function runQuestion(env: BubbleEnv, question: string): Promise<void> {
  const note = env.note()
  const factsText = factsJSON(computeNoteFacts(note))
  const turns = env.history()
  const msg = newMessage({ role: 'assistant', content: '', action: 'question', streaming: true })
  env.sink.add(msg)

  const overhead = messagesTokens(questionMessages(note.title, '', false, factsText, [], question))
  const page = await fitPage(env, overhead, turns)
  const meta = condensedMeta(page)
  if (meta) env.sink.patch(msg.id, (m) => ({ ...m, meta }))
  const used = overhead + messagesTokens([{ role: 'user', content: page.text }])
  const history = fitTurns(turns, usableBudget(env.budget) - used)

  const { stopped } = await streamInto(env, msg.id,
    questionMessages(note.title, page.text, page.condensed, factsText, history, question), GEN.question)
  if (stopped) env.sink.patch(msg.id, (m) => ({ ...m, meta: m.meta ? `${m.meta} · Stopped` : 'Stopped' }))
}

/** A free-text message: the model picks the intent from the message alone. */
export async function runMessage(env: BubbleEnv, text: string): Promise<void> {
  const selection = env.bridge.selection()
  const intent = await routeNoteIntent(env.provider, text, selection !== null)
  if (env.isStopped()) return
  switch (intent.kind) {
    case 'summarize': return runSummarize(env)
    case 'continue': return runContinue(env)
    case 'suggest_title': return runSuggestTitle(env)
    case 'suggest_tags': return runSuggestTags(env)
    case 'rewrite':
      if (!selection) { notice(env, 'Select the text you want rewritten in the note, then ask again.'); return }
      return runRewrite(env, intent.style, selection)
    case 'extract_tasks':
      notice(env, "Turning a note into tasks isn't available in the bubble yet.")
      return
    case 'question': return runQuestion(env, text)
  }
}
