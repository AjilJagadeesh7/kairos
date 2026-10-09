import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './miniMarkdown'

describe('miniMarkdown', () => {
  it('parses blocks: headings, paragraphs, lists, code', () => {
    expect(parseMarkdown('## Plan\n\nFirst line\nsecond line\n\n- one\n- **two**\n\n1. a\n2. b\n\n```\nx = 1\n```').map((b) => b.t))
      .toEqual(['h', 'p', 'ul', 'ol', 'pre'])
    expect(parseMarkdown('3. c\n4. d')[0]).toMatchObject({ t: 'ol', start: 3, items: [[{ t: 'text', v: 'c' }], [{ t: 'text', v: 'd' }]] })
  })

  it('parses inline bold, italic, code, citations and safe links only', () => {
    expect(parseInline('Use **Postgres** with `pgx` [1][2], *fast*.')).toEqual([
      { t: 'text', v: 'Use ' }, { t: 'strong', c: [{ t: 'text', v: 'Postgres' }] }, { t: 'text', v: ' with ' },
      { t: 'code', v: 'pgx' }, { t: 'text', v: ' ' }, { t: 'cite', n: 1 }, { t: 'cite', n: 2 }, { t: 'text', v: ', ' },
      { t: 'em', c: [{ t: 'text', v: 'fast' }] }, { t: 'text', v: '.' },
    ])
    expect(parseInline('[docs](https://go.dev)')).toEqual([{ t: 'link', href: 'https://go.dev', c: [{ t: 'text', v: 'docs' }] }])
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ t: 'text', v: 'x' }, { t: 'text', v: ')' }])
  })

  it('leaves unclosed markers as text while streaming', () => {
    expect(parseInline('half **bold')).toEqual([{ t: 'text', v: 'half **bold' }])
    expect(parseInline('snake_case_name')).toEqual([{ t: 'text', v: 'snake_case_name' }])
  })
})
