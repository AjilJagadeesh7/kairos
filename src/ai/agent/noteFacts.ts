/** Facts about a note, computed in code so the model never does arithmetic. */

export interface NoteFacts {
  title: string
  words: number
  headings: number
  openChecklistItems: number
  doneChecklistItems: number
  tags: string[]
  lastEdited: string
}

export interface NoteFactsInput {
  title: string
  content: string
  tags: string[]
  updatedAt: string
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0
}

export function computeNoteFacts(note: NoteFactsInput): NoteFacts {
  return {
    title: note.title || 'Untitled',
    words: countWords(note.content.replace(/\[[ xX]\]/g, '')),
    headings: note.content.match(/^#{1,6}\s/gm)?.length ?? 0,
    openChecklistItems: note.content.match(/^\s*[-*+]\s+\[ \]/gm)?.length ?? 0,
    doneChecklistItems: note.content.match(/^\s*[-*+]\s+\[[xX]\]/gm)?.length ?? 0,
    tags: note.tags,
    lastEdited: note.updatedAt,
  }
}

export function factsJSON(facts: NoteFacts): string {
  return JSON.stringify(facts)
}

/** "1,240 words · edited 3 days ago" — the header above a note summary. */
export function factsHeader(facts: NoteFacts, now = Date.now()): string {
  const words = `${facts.words.toLocaleString('en-US')} word${facts.words === 1 ? '' : 's'}`
  const edited = Date.parse(facts.lastEdited)
  return Number.isNaN(edited) ? words : `${words} · edited ${relative(now - edited)}`
}

function relative(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
