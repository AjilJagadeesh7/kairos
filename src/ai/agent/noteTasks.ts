/**
 * "Turn this into tasks": unchecked checklist lines are found by code, action
 * items in prose by the model. Every model item must quote the note, and code
 * checks the quote is really there — an item it can't find is shown greyed as
 * "not found in the note" and is never created. Nothing here writes anything.
 */
import { v4 as uuid } from 'uuid'
import { chunkMarkdown } from '../text/chunk'
import { estimateTokens } from '../text/tokens'
import { annotateRelativeDates, isoDate } from '../text/relativeDates'
import { messagesTokens, pageAllowance } from './budget'
import { GEN, newMessage, notice } from './bubbleEnv'
import { parseDue } from './boardPlan'
import { MAX_EXTRACTED, NOTE_TASKS_SCHEMA, noteTasksMessages } from '../prompts/noteTasks.v1'
import type { BubbleEnv, ExtractedTask, Priority } from '../../types'

const UNCHECKED = /^\s*[-*+]\s+\[ \]\s+(.+)$/
const CHECKED = /^\s*[-*+]\s+\[[xX]\]\s+(.+)$/
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']

/** Lowercase words only: markdown, list markers and punctuation removed. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** True when `quote` is in the note: verbatim (ignoring markdown/punctuation), or ≥ 85% of its words in order-insensitive form. */
export function isGrounded(quote: string, noteNormalized: string, noteWords: Set<string>): boolean {
  const q = normalizeForMatch(quote)
  if (!q) return false
  if (noteNormalized.includes(q)) return true
  const words = q.split(' ').filter((w) => w.length > 2)
  if (words.length < 3) return false
  return words.filter((w) => noteWords.has(w)).length / words.length >= 0.85
}

/** Plain title from a checklist line: links unwrapped, emphasis dropped. */
export function plainTitle(line: string): string {
  return line
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, a, b) => b || a)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

/** Unchecked `- [ ]` items, in order. A single date in the line becomes the due date. */
export function checklistTasks(markdown: string, now: Date): ExtractedTask[] {
  return markdown.split('\n').flatMap((line) => {
    const m = line.match(UNCHECKED)
    if (!m || !m[1].trim()) return []
    const dates = annotateRelativeDates(m[1], now).match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []
    const due = dates.length === 1 ? parseDue(dates[0]) : null
    return [{
      id: uuid(), title: plainTitle(m[1]), priority: null, quote: line.trim(), origin: 'checklist' as const,
      ...(due && 'ok' in due ? { due: due.ok } : {}),
    }]
  })
}

interface RawTask { title?: string; quote?: string; due?: string; priority?: string }

/** Checks the model's items against the note and merges them with the checklist items. */
export function mergeTasks(markdown: string, checklist: ExtractedTask[], raw: RawTask[], annotated: string): ExtractedTask[] {
  const noteNorm = `${normalizeForMatch(markdown)} ${normalizeForMatch(annotated)}`
  const noteWords = new Set(noteNorm.split(' '))
  const done = markdown.split('\n').flatMap((l) => {
    const m = l.match(CHECKED)
    return m ? [normalizeForMatch(m[1])] : []
  })
  const out = [...checklist]
  const seenTitles = new Set(checklist.map((t) => normalizeForMatch(t.title)))

  for (const r of raw) {
    const title = plainTitle(r.title ?? '')
    const quote = (r.quote ?? '').trim()
    if (!title) continue
    const q = normalizeForMatch(quote)
    // Already a checklist item: keep the checklist one, take the model's date/priority.
    const twin = out.find((t) => t.origin === 'checklist' && q && (normalizeForMatch(t.quote).includes(q) || q.includes(normalizeForMatch(t.quote))))
    const due = r.due ? parseDue(r.due) : null
    const priority = PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : null
    if (twin) {
      if (!twin.due && due && 'ok' in due) twin.due = due.ok
      if (!twin.priority && priority) twin.priority = priority
      continue
    }
    if (seenTitles.has(normalizeForMatch(title))) continue
    seenTitles.add(normalizeForMatch(title))
    const task: ExtractedTask = {
      id: uuid(), title, quote, origin: 'model', priority,
      ...(due && 'ok' in due ? { due: due.ok } : {}),
    }
    if (!isGrounded(quote, noteNorm, noteWords)) task.unresolved = 'Not found in the note'
    else if (q && done.some((d) => d && (d.includes(q) || q.includes(d)))) task.unresolved = 'Already done in the note'
    out.push(task)
  }
  return out
}

/**
 * Extracts action items from the note (or the selection, when there is one)
 * and proposes them as a task plan. Long notes are read in parts, never cut.
 */
export async function runExtractTasks(env: BubbleEnv): Promise<void> {
  const note = env.note()
  const selection = env.bridge.selection()
  const source = selection?.markdown ?? note.content
  const now = new Date()
  const today = isoDate(now)
  const annotated = annotateRelativeDates(source, now)
  const checklist = checklistTasks(source, now)

  const overhead = messagesTokens(noteTasksMessages(note.title, '', today, { index: 1, total: 1 }))
  const allowance = Math.max(300, pageAllowance(env.budget, overhead))
  const parts = estimateTokens(annotated) <= allowance ? [annotated] : chunkMarkdown(annotated, allowance).map((c) => c.text)
  const raw: RawTask[] = []
  try {
    for (let i = 0; i < parts.length; i++) {
      if (env.isStopped()) return
      env.sink.progress(parts.length > 1 ? `Reading part ${i + 1} of ${parts.length}…` : 'Looking for action items…')
      const part = parts.length > 1 ? { index: i + 1, total: parts.length } : null
      const out = await env.provider.generateJSON<{ tasks: RawTask[] }>(
        noteTasksMessages(note.title || 'Untitled', parts[i], today, part), NOTE_TASKS_SCHEMA, GEN.extract)
      raw.push(...(out.tasks ?? []))
    }
  } finally {
    env.sink.progress(null)
  }
  if (env.isStopped()) return

  const tasks = mergeTasks(source, checklist, raw, annotated)
  const usable = tasks.filter((t) => !t.unresolved)
  if (!usable.length) {
    notice(env, tasks.length
      ? 'No usable action items — what the model suggested isn\'t in the note.'
      : `No action items found in ${selection ? 'the selection' : 'this note'}.`)
    if (!tasks.length) return
  }
  if (usable.length > MAX_EXTRACTED) {
    notice(env, `Found ${usable.length} action items — more than ${MAX_EXTRACTED} at once. Select part of the note and try again.`)
    return
  }
  const from = selection ? 'the selection' : 'this note'
  env.sink.add(newMessage({
    role: 'assistant',
    action: 'extract_tasks',
    content: `${usable.length} action item${usable.length === 1 ? '' : 's'} from ${from} — pick a board, then apply. Each card links back to this note.`,
    meta: parts.length > 1 ? `Long note — read in ${parts.length} parts, nothing skipped` : undefined,
    usage: env.provider.lastUsage() ?? undefined,
    taskPlan: {
      noteId: note.id, noteTitle: note.title, tasks,
      selected: usable.map((t) => t.id), boardId: null, columnId: null, state: 'pending',
    },
  }))
}
