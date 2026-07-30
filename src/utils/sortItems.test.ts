import { describe, it, expect } from 'vitest'
import { sortItems, sortNames, nameOrder, dirLabel } from './sortItems'
import type { SortPref } from '../types'

interface Row { name: string; createdAt: string; updatedAt: string }

const rows: Row[] = [
  { name: 'banana', createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-03-01T00:00:00Z' },
  { name: 'Apple',  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-03-03T00:00:00Z' },
  { name: 'cherry', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-03-02T00:00:00Z' },
]

const names = (list: Row[]) => list.map(r => r.name)
const by = (pref: SortPref) => names(sortItems(rows, pref, r => r.name))

describe('sortItems', () => {
  it('sorts by name A→Z, ignoring case', () => {
    expect(by({ field: 'title', dir: 'asc' })).toEqual(['Apple', 'banana', 'cherry'])
  })

  it('sorts by name Z→A', () => {
    expect(by({ field: 'title', dir: 'desc' })).toEqual(['cherry', 'banana', 'Apple'])
  })

  it('sorts by updated, newest first', () => {
    expect(by({ field: 'updated', dir: 'desc' })).toEqual(['Apple', 'cherry', 'banana'])
  })

  it('sorts by updated, oldest first', () => {
    expect(by({ field: 'updated', dir: 'asc' })).toEqual(['banana', 'cherry', 'Apple'])
  })

  it('sorts by created independently of updated', () => {
    expect(by({ field: 'created', dir: 'asc' })).toEqual(['Apple', 'cherry', 'banana'])
  })

  it('never mutates the input array', () => {
    const before = names(rows)
    sortItems(rows, { field: 'title', dir: 'desc' }, r => r.name)
    expect(names(rows)).toEqual(before)
  })

  it('orders numbers naturally rather than lexically', () => {
    const numbered: Row[] = ['Note 10', 'Note 2', 'Note 1'].map(name => ({
      name, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    }))
    const sorted = sortItems(numbered, { field: 'title', dir: 'asc' }, r => r.name)
    expect(names(sorted)).toEqual(['Note 1', 'Note 2', 'Note 10'])
  })

  it('falls back to name when timestamps tie', () => {
    const tied: Row[] = ['zeta', 'alpha'].map(name => ({
      name, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    }))
    const sorted = sortItems(tied, { field: 'updated', dir: 'desc' }, r => r.name)
    expect(names(sorted)).toEqual(['alpha', 'zeta'])
  })

  it('treats an unparseable date as the epoch instead of throwing', () => {
    const broken: Row[] = [
      { name: 'good', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      { name: 'bad',  createdAt: 'not-a-date',           updatedAt: 'not-a-date' },
    ]
    const sorted = sortItems(broken, { field: 'updated', dir: 'desc' }, r => r.name)
    expect(names(sorted)).toEqual(['good', 'bad'])
  })
})

describe('folder name ordering', () => {
  it('reverses folders only when sorting by name', () => {
    expect(nameOrder({ field: 'title',   dir: 'desc' })).toBe(-1)
    expect(nameOrder({ field: 'title',   dir: 'asc'  })).toBe(1)
    // Dates mean nothing for a folder, so it stays A→Z either way.
    expect(nameOrder({ field: 'updated', dir: 'desc' })).toBe(1)
    expect(nameOrder({ field: 'created', dir: 'desc' })).toBe(1)
  })

  it('sortNames follows that rule', () => {
    const folders = ['Work', 'archive', 'Bills']
    expect(sortNames(folders, { field: 'title', dir: 'asc' })).toEqual(['archive', 'Bills', 'Work'])
    expect(sortNames(folders, { field: 'title', dir: 'desc' })).toEqual(['Work', 'Bills', 'archive'])
    expect(sortNames(folders, { field: 'updated', dir: 'desc' })).toEqual(['archive', 'Bills', 'Work'])
  })
})

describe('dirLabel', () => {
  it('describes text and date directions differently', () => {
    expect(dirLabel('title', 'asc')).toBe('A → Z')
    expect(dirLabel('title', 'desc')).toBe('Z → A')
    expect(dirLabel('updated', 'asc')).toBe('Oldest first')
    expect(dirLabel('created', 'desc')).toBe('Newest first')
  })
})
