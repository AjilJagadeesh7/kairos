// @vitest-environment happy-dom
// parseWebPage uses DOMParser; the default node environment has no DOM.
import { describe, it, expect } from 'vitest'
import { parseWebPage } from './webReader'

const BASE = 'https://example.com/posts/hello'

function page(body: string, head = ''): string {
  return `<!doctype html><html><head><title>Fallback title</title>${head}</head><body>${body}</body></html>`
}

/** Enough prose to clear the article-detection threshold. */
const LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor. '.repeat(4)

describe('parseWebPage — metadata', () => {
  it('prefers OpenGraph over the <title> tag', () => {
    const { meta } = parseWebPage(page('<p>x</p>', '<meta property="og:title" content="OG Title">'), BASE)
    expect(meta.title).toBe('OG Title')
  })

  it('falls back to <title>, then the hostname', () => {
    expect(parseWebPage(page('<p>x</p>'), BASE).meta.title).toBe('Fallback title')
    expect(parseWebPage('<html><body></body></html>', BASE).meta.title).toBe('example.com')
  })

  it('resolves relative image and favicon URLs against the page', () => {
    const { meta } = parseWebPage(
      page('<p>x</p>', '<meta property="og:image" content="/img/cover.png"><link rel="icon" href="/fav.png">'),
      BASE,
    )
    expect(meta.image).toBe('https://example.com/img/cover.png')
    expect(meta.favicon).toBe('https://example.com/fav.png')
  })
})

describe('parseWebPage — article extraction', () => {
  it('pulls headings, paragraphs and lists out of <article>', () => {
    const { blocks } = parseWebPage(page(`
      <nav><a href="/">nav junk</a></nav>
      <article>
        <h1>The Headline</h1>
        <p>${LONG}</p>
        <ul><li>first</li><li>second</li></ul>
      </article>
    `), BASE)

    expect(blocks[0]).toEqual({ kind: 'heading', level: 1, text: 'The Headline' })
    expect(blocks.some(b => b.kind === 'paragraph')).toBe(true)
    const list = blocks.find(b => b.kind === 'list')
    expect(list).toBeDefined()
    if (list?.kind === 'list') {
      expect(list.ordered).toBe(false)
      expect(list.items.map(i => i.map(s => s.text).join(''))).toEqual(['first', 'second'])
    }
  })

  it('drops nav, script and style content', () => {
    const { blocks } = parseWebPage(page(`
      <nav><p>NAVIGATION</p></nav>
      <script>alert('xss')</script>
      <style>.x{color:red}</style>
      <article><p>${LONG}</p></article>
    `), BASE)

    const text = JSON.stringify(blocks)
    expect(text).not.toContain('NAVIGATION')
    expect(text).not.toContain('alert')
    expect(text).not.toContain('color:red')
  })

  it('returns no blocks for a page with no prose, so the caller shows a card', () => {
    const { blocks } = parseWebPage(page('<div><span>hi</span></div>'), BASE)
    expect(blocks).toEqual([])
  })

  it('keeps inline formatting and merges adjacent identical spans', () => {
    const { blocks } = parseWebPage(
      page(`<article><p>plain <strong>bo</strong><strong>ld</strong> tail. ${LONG}</p></article>`),
      BASE,
    )
    const para = blocks.find(b => b.kind === 'paragraph')
    expect(para?.kind).toBe('paragraph')
    if (para?.kind === 'paragraph') {
      const bold = para.spans.filter(s => s.strong)
      expect(bold).toHaveLength(1)
      expect(bold[0].text).toBe('bold')
    }
  })
})

describe('parseWebPage — URL safety', () => {
  it('strips javascript: links rather than emitting them', () => {
    const { blocks } = parseWebPage(
      page(`<article><p><a href="javascript:alert(1)">click</a> ${LONG}</p></article>`),
      BASE,
    )
    const para = blocks.find(b => b.kind === 'paragraph')
    if (para?.kind === 'paragraph') {
      expect(para.spans.every(s => s.href === undefined)).toBe(true)
      // The text survives — only the dangerous href is dropped.
      expect(para.spans.map(s => s.text).join(' ')).toContain('click')
    }
  })

  it('rejects data: images and resolves relative ones', () => {
    const evil = parseWebPage(page(`<article><p>${LONG}</p><img src="data:text/html,<script>1</script>"></article>`), BASE)
    expect(evil.blocks.some(b => b.kind === 'image')).toBe(false)

    const ok = parseWebPage(page(`<article><p>${LONG}</p><img src="../pic.png" alt="Pic"></article>`), BASE)
    const img = ok.blocks.find(b => b.kind === 'image')
    expect(img?.kind === 'image' && img.src).toBe('https://example.com/pic.png')
  })

  it('resolves relative anchors against the page URL', () => {
    const { blocks } = parseWebPage(
      page(`<article><p><a href="/other">link</a> ${LONG}</p></article>`),
      BASE,
    )
    const para = blocks.find(b => b.kind === 'paragraph')
    if (para?.kind === 'paragraph') {
      expect(para.spans.find(s => s.href)?.href).toBe('https://example.com/other')
    }
  })
})
