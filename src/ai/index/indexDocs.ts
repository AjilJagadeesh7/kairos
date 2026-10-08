/**
 * What the semantic index covers: notes and journal entries (journal counts
 * as notes). Each document is chunked on heading boundaries; chunk ids are
 * stable for unchanged text, so keyword and vector hits on the same chunk
 * line up.
 */
import { chunkMarkdown } from '../text/chunk'
import type { IndexChunk, VaultSnapshot } from '../../types'

/** ~300 estimated tokens: inside MiniLM's window, under the PRD's 400. */
export const CHUNK_TOKENS = 300

export interface IndexDoc {
  docId: string
  kind: 'note' | 'journal'
  title: string
  text: string
  tags: string[]
  updatedAt: string
}

/** Small stable hash (djb2) — only used to notice changed documents. */
export function hashText(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${text.length}:${(h >>> 0).toString(36)}`
}

export function vaultDocs(vault: VaultSnapshot): IndexDoc[] {
  return [
    ...vault.notes.map((n) => ({
      docId: n.id, kind: 'note' as const, title: n.title || 'Untitled note', text: n.content, tags: n.tags, updatedAt: n.updatedAt,
    })),
    ...vault.journal.map((j) => ({
      docId: j.date, kind: 'journal' as const, title: `Journal ${j.date}`, text: j.content, tags: [], updatedAt: j.updatedAt,
    })),
  ].filter((d) => d.text.trim() || d.title.trim())
}

export function docKey(doc: Pick<IndexDoc, 'kind' | 'docId'>): string {
  return `${doc.kind}:${doc.docId}`
}

export function docHash(doc: IndexDoc): string {
  return hashText(`${doc.title}\n${doc.tags.join(',')}\n${doc.text}`)
}

/** The document's chunks, without vectors. A note too short to chunk is one chunk. */
export function chunkDoc(doc: IndexDoc): IndexChunk[] {
  const hash = docHash(doc)
  const pieces = doc.text.trim() ? chunkMarkdown(doc.text, CHUNK_TOKENS) : [{ heading: '', text: doc.title, tokens: 0 }]
  return pieces.map((p, i) => ({
    id: `${docKey(doc)}#${i}`,
    docId: doc.docId,
    kind: doc.kind,
    title: doc.title,
    heading: p.heading,
    text: p.text,
    tags: doc.tags,
    updatedAt: doc.updatedAt,
    hash,
  }))
}

/** What gets embedded: the title and heading give a chunk its context. */
export function embedInput(chunk: Pick<IndexChunk, 'title' | 'heading' | 'text'>): string {
  return [chunk.title, chunk.heading, chunk.text].filter(Boolean).join('\n')
}
