import { describe, it, expect } from 'vitest'
import { buildSiteHtml } from './siteHtmlBuilder'
import { SITE_JS } from './siteAppScript'
import type { Note } from '../types'

function note(partial: Partial<Note> & { id: string; title: string }): Note {
  return {
    content: '',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    embedding: [],
    ...partial,
  } as Note
}

const notes: Note[] = [
  note({ id: 'a', title: 'Alpha', content: 'Links to [[Beta]] and [[Missing]].', tags: ['x'] }),
  note({ id: 'b', title: 'Beta', content: '# Beta\n\nBack to [[Alpha]].' }),
]

describe('buildSiteHtml', () => {
  const html = buildSiteHtml(notes, 'Test Vault')

  it('produces a single self-contained HTML document with Content/Graph tabs', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('data-tab="content"')
    expect(html).toContain('data-tab="graph"')
    expect(html).toContain('id="pane-graph"')
    expect(html).toContain('id="nav-list"')
    expect(html).toContain('Test Vault')
  })

  it('loads the same force-graph engine the app uses', () => {
    expect(html).toContain('force-graph@1.51')
  })

  it('embeds note data with resolved links, graph colour and size', () => {
    const m = html.match(/var DATA = (.+);\n/)
    expect(m).toBeTruthy()
    const data = JSON.parse(m![1].replace(/\\u003c/g, '<'))
    const alpha = data.notes.find((n: { id: string }) => n.id === 'a')
    expect(alpha.links).toEqual(['b'])          // Beta resolved; Missing dropped
    expect(alpha.html).toContain('href="#b"')   // wikilink linkified to Beta
    expect(alpha.html).toContain('class="wikilink"')
    expect(typeof alpha.color).toBe('string')
    expect(alpha.val).toBeGreaterThanOrEqual(1) // degree-scaled node size
  })

  it('embeds syntactically valid runtime JS', () => {
    // new Function only parses the body; the inner IIFE is not invoked here.
    expect(() => new Function(SITE_JS)).not.toThrow()
  })

  it('escapes < so embedded content cannot break out of the script block', () => {
    const evil = [note({ id: 'c', title: 'Evil', content: 'oops </script><script>alert(1)</script>' })]
    const out = buildSiteHtml(evil)
    expect(out).not.toContain('</script><script>alert(1)')
    expect(out).toContain('\\u003c/script')
  })
})
