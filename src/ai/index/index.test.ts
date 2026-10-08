import { describe, expect, it } from 'vitest'
import { buildIndex, normalize, type IndexStorage } from './buildIndex'
import { chunkDoc, docKey, vaultDocs } from './indexDocs'
import { retrieve } from './retrieve'
import { testVault, note } from '../agent/__fixtures__/vault'
import type { IndexChunk, VaultSnapshot } from '../../types'

function memoryStorage() {
  const rows = new Map<string, IndexChunk[]>()
  const storage: IndexStorage = {
    async state() {
      return new Map([...rows].map(([k, cs]) => [k, { hash: cs[0].hash, modelId: cs[0].modelId }]))
    },
    async put(key, chunks) { rows.set(key, chunks) },
    async remove(keys) { for (const k of keys) rows.delete(k) },
  }
  return { storage, rows, all: () => [...rows.values()].flat() }
}

/** A toy embedder: one dimension per topic word, so "database" questions land on Postgres text. */
const TOPICS = ['postgres', 'database', 'flight', 'travel', 'insurance', 'standup']
async function toyEmbed(text: string): Promise<number[]> {
  const t = text.toLowerCase()
  const v: number[] = TOPICS.map((w) => (t.includes(w) || (w === 'database' && t.includes('postgres')) || (w === 'travel' && t.includes('flight')) ? 1 : 0))
  return [...v, 0.01]
}

describe('buildIndex', () => {
  it('embeds every document once, then skips unchanged ones and removes deleted ones', async () => {
    const vault = testVault()
    const mem = memoryStorage()
    const calls: string[] = []
    const embed = async (t: string) => { calls.push(t); return toyEmbed(t) }
    const first = await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed, modelId: 'toy' })
    expect(first).toMatchObject({ embedded: 6, skipped: 0, removed: 0, stopped: false })
    expect(mem.all().every((c) => c.vector && c.modelId === 'toy')).toBe(true)

    const n = calls.length
    vault.notes = vault.notes.filter((x) => x.id !== 'n-old')
    vault.notes[0] = { ...vault.notes[0], content: `${vault.notes[0].content}\nNew line.`, updatedAt: new Date().toISOString() }
    const second = await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed, modelId: 'toy' })
    expect(second).toMatchObject({ embedded: 1, skipped: 4, removed: 1 })
    expect(calls.length - n).toBe(chunkDoc(vaultDocs(vault)[0]).length)
  })

  it('re-embeds everything when the model changes, and can be paused and resumed', async () => {
    const vault = testVault()
    const mem = memoryStorage()
    await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed: toyEmbed, modelId: 'a' })
    let left = 2
    const paused = await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed: toyEmbed, modelId: 'b', shouldStop: () => left-- <= 0 })
    expect(paused).toMatchObject({ stopped: true, embedded: 2 })
    const resumed = await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed: toyEmbed, modelId: 'b' })
    expect(resumed).toMatchObject({ embedded: 4, skipped: 2, stopped: false })
  })

  it('updates only the requested documents', async () => {
    const vault = testVault()
    const mem = memoryStorage()
    await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed: toyEmbed, modelId: 'toy' })
    vault.notes = vault.notes.filter((x) => x.id !== 'n-trip')
    const r = await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed: toyEmbed, modelId: 'toy', only: new Set(['note:n-trip', 'note:n-go']) })
    expect(r).toMatchObject({ removed: 1, skipped: 1, embedded: 0 })
    expect(mem.rows.has('note:n-trip')).toBe(false)
  })
})

describe('retrieve', () => {
  const opts = (vault: VaultSnapshot, stored: IndexChunk[] | null) => ({
    vault,
    indexed: stored ? async () => stored : null,
    embedQuery: stored ? async (q: string) => normalize(await toyEmbed(q)) : null,
    modelId: 'toy',
  })

  it('keyword mode finds notes by title, tags and text', async () => {
    const vault = testVault()
    const r = await retrieve('Postgres connection pool', {}, opts(vault, null))
    expect(r.mode).toBe('keyword')
    expect(r.chunks[0]).toMatchObject({ docId: 'n-go', heading: 'Storage' })
    const byTag = await retrieve('travel', {}, opts(vault, null))
    expect(byTag.chunks[0].docId).toBe('n-trip')
  })

  it('hybrid mode adds meaning: "database" finds the Postgres note without the word', async () => {
    const vault = testVault()
    const mem = memoryStorage()
    await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed: toyEmbed, modelId: 'toy' })
    const kw = await retrieve('database engine', {}, opts(vault, null))
    expect(kw.chunks.some((c) => c.docId === 'n-go')).toBe(false)
    const hy = await retrieve('database engine', {}, opts(vault, mem.all()))
    expect(hy.mode).toBe('hybrid')
    expect(hy.chunks[0].docId).toBe('n-go')
  })

  it('ignores vectors of text that changed since indexing, and applies since/tags filters', async () => {
    const vault = testVault()
    const mem = memoryStorage()
    await buildIndex({ docs: vaultDocs(vault), storage: mem.storage, embed: toyEmbed, modelId: 'toy' })
    vault.notes[0] = { ...vault.notes[0], content: 'Rewritten: nothing about storage anymore.', updatedAt: new Date().toISOString() }
    const r = await retrieve('database engine', {}, opts(vault, mem.all()))
    expect(r.chunks.some((c) => c.docId === 'n-go')).toBe(false)

    const recent = await retrieve('insurance', { since: '2026-10-01T00:00:00.000Z' }, opts(testVault(), null))
    expect(recent.chunks.some((c) => c.docId === 'n-trip')).toBe(false)
    const tagged = await retrieve('flights hotel', { tags: ['travel'] }, opts(testVault(), null))
    expect(tagged.chunks.every((c) => c.tags.includes('travel'))).toBe(true)
  })

  it('caps passages per note and in total', async () => {
    const big = note('n-big', 'Big', Array.from({ length: 20 }, (_, i) => `## Part ${i}\nkubernetes cluster notes ${'filler '.repeat(150)}`).join('\n\n'), new Date().toISOString())
    const vault: VaultSnapshot = { notes: [big], journal: [], boards: [] }
    const r = await retrieve('kubernetes cluster', {}, opts(vault, null))
    expect(r.chunks.length).toBe(3)
    expect(new Set(r.chunks.map((c) => docKey(c))).size).toBe(1)
  })
})
