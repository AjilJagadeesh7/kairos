import type { Note } from '../types'
import { markdownToHtml } from './markdownToHtml'
import { parseWikilinks } from './wikilinks'
import { colorForIndex } from './colorForIndex'
import { SITE_CSS, SITE_JS } from './siteAppScript'

interface SiteNote {
  id: string
  title: string
  tags: string[]
  html: string
  /** Resolved wikilink target ids within the export set. */
  links: string[]
  /** Node colour (golden-angle palette, matching the in-app graph). */
  color: string
  /** Node size driver: degree-scaled, matching the in-app graph (`val`). */
  val: number
}

function unescapeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
}

/**
 * Turn the inert `<span class="wikilink">Title</span>` emitted by markdownToHtml
 * into a clickable `<a href="#id">` when the target is among the exported notes.
 */
function linkifyWikilinks(html: string, titleToId: Map<string, string>): string {
  return html.replace(/<span class="wikilink">([^<]+)<\/span>/g, (full, label) => {
    const id = titleToId.get(unescapeEntities(label).trim().toLowerCase())
    return id ? `<a class="wikilink" href="#${encodeURIComponent(id)}">${label}</a>` : full
  })
}

/** Build the in-page note dataset, resolving wikilinks to ids within the set. */
function buildSiteNotes(notes: Note[]): SiteNote[] {
  const titleToId = new Map<string, string>()
  for (const n of notes) {
    const key = (n.title || '').trim().toLowerCase()
    if (key && !titleToId.has(key)) titleToId.set(key, n.id)
  }

  const links = new Map<string, string[]>()
  for (const n of notes) {
    links.set(n.id, parseWikilinks(n.content)
      .map((t) => titleToId.get(t.trim().toLowerCase()))
      .filter((id): id is string => !!id && id !== n.id))
  }

  // Undirected degree (both directions count), matching the in-app graph's `val`.
  const degree = new Map<string, number>()
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1)
  for (const [src, targets] of links) for (const tgt of targets) { bump(src); bump(tgt) }

  return notes.map((n, i) => ({
    id: n.id,
    title: n.title || 'Untitled',
    tags: n.tags,
    html: linkifyWikilinks(markdownToHtml(n.content), titleToId),
    links: links.get(n.id) ?? [],
    color: colorForIndex(i),
    val: Math.max(1, Math.min((degree.get(n.id) ?? 0) * 1.5 + 1, 14)),
  }))
}

/** Escape `<` so embedded note HTML can't break out of the <script> data block. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

const KATEX_DELIMS = [
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
]

const HEAD_LIBS = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/force-graph@1.51"></script>`

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/**
 * Build a single self-contained HTML file: sidebar (note list), content area,
 * and an interactive link graph. Deployable as-is (e.g. drop on Netlify).
 */
export function buildSiteHtml(notes: Note[], siteTitle = 'My Vault'): string {
  const data = { notes: buildSiteNotes(notes) }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escAttr(siteTitle)}</title>
${HEAD_LIBS}
<style>${SITE_CSS}</style>
</head>
<body>
<header class="topbar">
  <button class="icon-btn menu" id="btn-menu" aria-label="Toggle contents">&#9776;</button>
  <span class="brand">${escAttr(siteTitle)}<small>${data.notes.length} notes</small></span>
</header>
<nav id="sidebar">
  <div class="search-wrap"><input id="search" type="text" placeholder="Search notes…" autocomplete="off"></div>
  <div id="nav-list"></div>
</nav>
<main id="main">
  <div class="tabbar">
    <button class="tab" data-tab="content">Content</button>
    <button class="tab" data-tab="graph">Graph</button>
  </div>
  <div id="pane-content"><div id="content"></div></div>
  <div id="pane-graph"></div>
</main>
<script>
var DATA = ${safeJson(data)};
var KATEX_DELIMS = ${safeJson(KATEX_DELIMS)};
</script>
<script>${SITE_JS}</script>
</body>
</html>`
}
