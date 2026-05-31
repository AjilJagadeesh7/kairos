import * as yaml from 'js-yaml'
import type { Note } from '../../types'

const SYSTEM_KEYS = new Set(['id', 'title', 'tags', 'createdAt', 'updatedAt', 'folder', 'noSync'])

/** Serialize a Note to a markdown string with YAML-style frontmatter. */
export function serializeNote(note: Note): string {
  const lines = [
    '---',
    `id: ${note.id}`,
    `title: ${JSON.stringify(note.title)}`,
    `tags: ${JSON.stringify(note.tags)}`,
    `createdAt: ${note.createdAt}`,
    `updatedAt: ${note.updatedAt}`,
  ]
  if (note.folder) lines.push(`folder: ${JSON.stringify(note.folder)}`)
  if (note.noSync) lines.push('noSync: true')

  if (note.userFrontmatter) {
    for (const [key, val] of Object.entries(note.userFrontmatter)) {
      if (SYSTEM_KEYS.has(key)) continue
      // yaml.dump adds a trailing newline; trim it for inline style
      const serialized = yaml.dump(val, { lineWidth: -1 }).trim()
      lines.push(`${key}: ${serialized}`)
    }
  }

  lines.push('---', '', note.content)
  return lines.join('\n')
}

/** Parse a serialized markdown string back into a Note. */
export function deserializeNote(raw: string): Note {
  if (!raw.startsWith('---\n')) throw new Error('Missing frontmatter separator')
  const rest = raw.slice(4)
  const closeIdx = rest.indexOf('\n---\n')
  if (closeIdx === -1) throw new Error('Unclosed frontmatter block')

  const fm = rest.slice(0, closeIdx)
  const body = rest.slice(closeIdx + 5) // skip '\n---\n'

  // Regex extractor for system fields (keeps backward compat with old format)
  const get = (key: string) => fm.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1] ?? ''
  const rawFolder = get('folder')
  const noSync = get('noSync') === 'true'

  // Extract user-defined (non-system) fields via js-yaml
  let userFrontmatter: Record<string, unknown> | undefined
  try {
    const parsed = yaml.load(fm, { schema: yaml.JSON_SCHEMA })
    if (parsed && typeof parsed === 'object') {
      const entries = Object.entries(parsed as Record<string, unknown>)
        .filter(([k]) => !SYSTEM_KEYS.has(k))
      if (entries.length > 0) userFrontmatter = Object.fromEntries(entries)
    }
  } catch { /* ignore malformed yaml in user fields */ }

  return {
    id: get('id'),
    title: JSON.parse(get('title') || '""') as string,
    tags: JSON.parse(get('tags') || '[]') as string[],
    createdAt: get('createdAt') || new Date().toISOString(),
    updatedAt: get('updatedAt') || new Date().toISOString(),
    content: body.replace(/^\n/, ''), // strip leading blank line added by serializer
    embedding: [], // embeddings live in the db.embeddings table, not in the note record
    folder: rawFolder ? (JSON.parse(rawFolder) as string) || undefined : undefined,
    userFrontmatter,
    ...(noSync ? { noSync: true } : {}),
  }
}

/** Extract just the noteId from a filename like "{noteId}.md". */
export function pathToNoteId(filename: string): string {
  return filename.endsWith('.md') ? filename.slice(0, -3) : filename
}

/** Convert a noteId to its .md filename. */
export function noteIdToPath(noteId: string): string {
  return `${noteId}.md`
}
