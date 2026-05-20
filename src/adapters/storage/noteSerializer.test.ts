import { describe, it, expect } from 'vitest'
import { serializeNote, deserializeNote, pathToNoteId, noteIdToPath } from './noteSerializer'
import type { Note } from '../../types'

describe('noteSerializer', () => {
  const sampleNote: Note = {
    id: 'test-id-123',
    title: 'My "Cool" Note!',
    tags: ['work', 'ideas'],
    createdAt: '2026-05-20T08:00:00.000Z',
    updatedAt: '2026-05-20T09:00:00.000Z',
    content: 'This is the note body content.\nWith multiple lines.',
    embedding: [],
  }

  it('correctly serializes a note to frontmatter + markdown', () => {
    const raw = serializeNote(sampleNote)
    expect(raw).toContain('---')
    expect(raw).toContain('id: test-id-123')
    expect(raw).toContain('title: "My \\"Cool\\" Note!"')
    expect(raw).toContain('tags: ["work","ideas"]')
    expect(raw).toContain('createdAt: 2026-05-20T08:00:00.000Z')
    expect(raw).toContain('updatedAt: 2026-05-20T09:00:00.000Z')
    expect(raw.endsWith('This is the note body content.\nWith multiple lines.')).toBe(true)
  })

  it('correctly deserializes a note from markdown string', () => {
    const raw = serializeNote(sampleNote)
    const note = deserializeNote(raw)
    expect(note.id).toBe(sampleNote.id)
    expect(note.title).toBe(sampleNote.title)
    expect(note.tags).toEqual(sampleNote.tags)
    expect(note.createdAt).toBe(sampleNote.createdAt)
    expect(note.updatedAt).toBe(sampleNote.updatedAt)
    expect(note.content).toBe(sampleNote.content)
    expect(note.embedding).toEqual([])
  })

  it('throws an error if frontmatter is missing or unclosed', () => {
    expect(() => deserializeNote('No frontmatter')).toThrow('Missing frontmatter separator')
    expect(() => deserializeNote('---\nid: 1\nno-closing')).toThrow('Unclosed frontmatter block')
  })

  it('converts paths and note IDs correctly', () => {
    expect(pathToNoteId('my-note-id.md')).toBe('my-note-id')
    expect(pathToNoteId('my-note-id')).toBe('my-note-id')
    expect(noteIdToPath('my-note-id')).toBe('my-note-id.md')
  })
})
