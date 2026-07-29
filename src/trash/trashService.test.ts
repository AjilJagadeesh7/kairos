import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrashItem } from '../types'

const store = new Map<string, TrashItem>()

vi.mock('../db/schema', () => ({
  putTrashItem: vi.fn(async (item: TrashItem) => { store.set(item.id, item) }),
  getAllTrashItems: vi.fn(async () =>
    [...store.values()].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))),
  deleteTrashItems: vi.fn(async (ids: string[]) => { for (const id of ids) store.delete(id) }),
  clearTrash: vi.fn(async () => { store.clear() }),
}))

const { moveToTrash, expiryOf, sweepExpiredTrash, listTrash, trashNote } =
  await import('./trashService')

const DAY = 86_400_000

function item(overrides: Partial<TrashItem> = {}): TrashItem {
  return {
    id: 'x', kind: 'note', itemId: 'n1', title: 'Note',
    deletedAt: new Date().toISOString(), payload: '{}', ...overrides,
  }
}

/** Seed a record that was deleted `daysAgo` days ago. */
async function seed(id: string, daysAgo: number): Promise<void> {
  store.set(id, item({ id, deletedAt: new Date(Date.now() - daysAgo * DAY).toISOString() }))
}

beforeEach(() => { store.clear() })

describe('expiryOf', () => {
  it('returns null when retention is set to keep forever', () => {
    expect(expiryOf(item(), 0)).toBeNull()
    expect(expiryOf(item(), -1)).toBeNull()
  })

  it('adds the retention window to the delete time', () => {
    const deletedAt = '2026-01-01T00:00:00.000Z'
    expect(expiryOf(item({ deletedAt }), 7)?.toISOString()).toBe('2026-01-08T00:00:00.000Z')
  })
})

describe('sweepExpiredTrash', () => {
  it('purges only the items past the retention window', async () => {
    await seed('old', 40)
    await seed('edge', 31)
    await seed('fresh', 2)

    const purged = await sweepExpiredTrash(30)

    expect(purged).toBe(2)
    expect((await listTrash()).map(i => i.id)).toEqual(['fresh'])
  })

  it('keeps everything when retention is forever', async () => {
    await seed('ancient', 5000)
    expect(await sweepExpiredTrash(0)).toBe(0)
    expect(await listTrash()).toHaveLength(1)
  })

  it('is a no-op on an empty trash', async () => {
    expect(await sweepExpiredTrash(7)).toBe(0)
  })

  it('shortening retention purges items that are already past the new window', async () => {
    await seed('a', 10)
    expect(await sweepExpiredTrash(30)).toBe(0)
    expect(await sweepExpiredTrash(7)).toBe(1)
  })
})

describe('capture', () => {
  it('stamps an id and deletedAt onto a new record', async () => {
    await moveToTrash({ kind: 'canvas', itemId: 'c1', title: 'Board', payload: '{}' })
    const [saved] = await listTrash()
    expect(saved.id).toBeTruthy()
    expect(Date.parse(saved.deletedAt)).not.toBeNaN()
  })

  it('keeps a note restorable but drops its derived embedding', async () => {
    await trashNote({
      id: 'n1', title: 'Recipe', content: '# Soup', tags: ['food'], embedding: [0.1, 0.2],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', folder: 'Cooking',
    })

    const [saved] = await listTrash()
    expect(saved.title).toBe('Recipe')
    expect(saved.subtitle).toBe('Cooking')

    const payload = JSON.parse(saved.payload) as Record<string, unknown>
    expect(payload.content).toBe('# Soup')
    expect(payload.tags).toEqual(['food'])
    expect(payload).not.toHaveProperty('embedding')
  })

  it('falls back to a placeholder title for untitled items', async () => {
    await trashNote({
      id: 'n2', title: '', content: '', tags: [], embedding: [],
      createdAt: '', updatedAt: '',
    })
    expect((await listTrash())[0].title).toBe('Untitled note')
  })
})
