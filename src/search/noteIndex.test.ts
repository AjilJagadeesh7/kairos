import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildIndex, indexNote, deindexNote, searchNotes, isIndexReady } from './noteIndex'
import type { Note } from '../types'

vi.mock('./tauriSearch', () => ({
  buildTauriIndex:  vi.fn(),
  updateTauriIndex: vi.fn(),
  removeTauriIndex: vi.fn(),
  searchTauri:      vi.fn().mockResolvedValue(null),
}))

vi.mock('../utils/platform', () => ({
  isDesktop: vi.fn().mockReturnValue(false),
  isMobile:  vi.fn().mockReturnValue(false),
}))

function note(id: string, title: string, content: string, tags: string[] = []): Note {
  return { id, title, content, tags, embedding: [], createdAt: '', updatedAt: '' }
}

/** Flush all pending microtasks + one macrotask so buildIndex's async IIFE completes. */
const flushBuild = () => new Promise(r => setTimeout(r, 0))

beforeEach(async () => {
  buildIndex([])
  await flushBuild()
})

describe('isIndexReady', () => {
  it('is true after buildIndex is called', () => {
    expect(isIndexReady()).toBe(true)
  })
})

describe('buildIndex', () => {
  it('makes notes searchable', async () => {
    buildIndex([note('n1', 'Rust Programming', 'ownership and borrowing')])
    await flushBuild()
    const results = await searchNotes('ownership')
    expect(results.map(r => r.id)).toContain('n1')
  })

  it('replaces previous index on rebuild', async () => {
    buildIndex([note('n1', 'Old Note', 'old content')])
    buildIndex([note('n2', 'New Note', 'new content')])
    await flushBuild()
    expect(await searchNotes('old')).toHaveLength(0)
    expect((await searchNotes('new')).map(r => r.id)).toContain('n2')
  })
})

describe('searchNotes', () => {
  beforeEach(async () => {
    buildIndex([
      note('n1', 'React Hooks', 'useState useEffect'),
      note('n2', 'TypeScript Types', 'generics interfaces'),
      note('n3', 'React Router', 'navigation routes', ['frontend']),
    ])
    await flushBuild()
  })

  it('returns empty array for empty query', async () => {
    expect(await searchNotes('')).toEqual([])
    expect(await searchNotes('   ')).toEqual([])
  })

  it('finds notes by title', async () => {
    const ids = (await searchNotes('TypeScript')).map(r => r.id)
    expect(ids).toContain('n2')
  })

  it('finds notes by content', async () => {
    const ids = (await searchNotes('useState')).map(r => r.id)
    expect(ids).toContain('n1')
  })

  it('finds notes by tag', async () => {
    const ids = (await searchNotes('frontend')).map(r => r.id)
    expect(ids).toContain('n3')
  })

  it('returns results with score and terms', async () => {
    const results = await searchNotes('React')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toHaveProperty('score')
    expect(results[0]).toHaveProperty('terms')
  })

  it('returns empty array for empty query (guard)', async () => {
    expect(await searchNotes('')).toEqual([])
  })
})

describe('indexNote', () => {
  it('adds a note to an existing index', async () => {
    indexNote(note('new', 'Brand New', 'fresh content'))
    expect((await searchNotes('fresh')).map(r => r.id)).toContain('new')
  })

  it('updating an existing note replaces it', async () => {
    buildIndex([note('n1', 'Original Title', 'original content')])
    await flushBuild()
    indexNote(note('n1', 'Updated Title', 'updated content'))
    expect((await searchNotes('updated')).map(r => r.id)).toContain('n1')
    expect(await searchNotes('original')).toHaveLength(0)
  })
})

describe('deindexNote', () => {
  it('removes a note from the index', async () => {
    buildIndex([note('n1', 'Remove Me', 'remove this')])
    await flushBuild()
    deindexNote('n1')
    expect(await searchNotes('remove')).toHaveLength(0)
  })

  it('is a no-op for a non-existent id', () => {
    expect(() => deindexNote('does-not-exist')).not.toThrow()
  })
})
