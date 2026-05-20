import { describe, it, expect } from 'vitest'
import { parseWikilinks, parseTransclusions, parseTags } from './wikilinks'

describe('parseWikilinks', () => {
  it('parses a standard wikilink', () => {
    expect(parseWikilinks('See [[My Note]] for details')).toEqual(['My Note'])
  })

  it('parses multiple wikilinks', () => {
    const result = parseWikilinks('[[Alpha]] and [[Beta]]')
    expect(result).toContain('Alpha')
    expect(result).toContain('Beta')
    expect(result).toHaveLength(2)
  })

  it('deduplicates repeated links', () => {
    expect(parseWikilinks('[[A]] and [[A]]')).toHaveLength(1)
  })

  it('parses Milkdown-escaped wikilinks', () => {
    expect(parseWikilinks('\\[\\[Note Title\\]\\]')).toEqual(['Note Title'])
  })

  it('does NOT match transclusions (![[...]])', () => {
    expect(parseWikilinks('![[embed]]')).toEqual([])
  })

  it('returns empty array for no links', () => {
    expect(parseWikilinks('plain text with no links')).toEqual([])
  })

  it('trims whitespace inside brackets', () => {
    expect(parseWikilinks('[[ spaced ]]')).toEqual(['spaced'])
  })
})

describe('parseTransclusions', () => {
  it('parses a transclusion', () => {
    expect(parseTransclusions('![[Image.png]]')).toEqual(['Image.png'])
  })

  it('does NOT match plain wikilinks', () => {
    expect(parseTransclusions('[[note]]')).toEqual([])
  })

  it('deduplicates', () => {
    expect(parseTransclusions('![[A]] ![[A]]')).toHaveLength(1)
  })

  it('returns empty for no transclusions', () => {
    expect(parseTransclusions('no embeds here')).toEqual([])
  })
})

describe('parseTags', () => {
  it('parses a simple tag', () => {
    expect(parseTags('hello #react world')).toEqual(['react'])
  })

  it('lowercases tags', () => {
    expect(parseTags('#React')).toEqual(['react'])
  })

  it('ignores single-character tags (below min length 2)', () => {
    expect(parseTags('#a is short')).toEqual([])
  })

  it('deduplicates tags', () => {
    expect(parseTags('#react #react')).toHaveLength(1)
  })

  it('does NOT match mid-word hashtags', () => {
    expect(parseTags('word#tag')).toEqual([])
  })

  it('parses tag at start of string', () => {
    expect(parseTags('#typescript is great')).toEqual(['typescript'])
  })

  it('parses multiple distinct tags', () => {
    const tags = parseTags('#react #typescript #vite')
    expect(tags).toContain('react')
    expect(tags).toContain('typescript')
    expect(tags).toContain('vite')
  })

  it('returns empty for no tags', () => {
    expect(parseTags('no tags here')).toEqual([])
  })
})
