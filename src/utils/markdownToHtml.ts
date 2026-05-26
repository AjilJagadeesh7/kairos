function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(s: string): string {
  // 1. Extract code spans first — protect them from all other transforms
  const codes: string[] = []
  let t = s.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${esc(code)}</code>`)
    return `\x00${codes.length - 1}\x00`
  })

  // 2. Unescape ProseMirror's markdown escapes (\[ → [, \] → ], \* → *, etc.)
  t = t.replace(/\\([[\]()\\*_`~!])/g, '$1')

  // 3. Process markdown in order
  t = t
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${esc(href)}">${esc(text)}</a>`)
    .replace(/\[\[([^\]]+)\]\]/g, (_, title) => `<span class="wikilink">${esc(title)}</span>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\s][^_]*)_/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\$([^$\n]+)\$/g, (_, math) => `<span class="math-inline">\\(${math}\\)</span>`)

  // 4. Restore code spans
  return t.replace(/\x00(\d+)\x00/g, (_, i) => codes[parseInt(i)])
}

function renderTable(rows: string[]): string {
  const cells = (row: string) =>
    row.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1)
  const header = cells(rows[0])
  const body = rows.slice(2)
  const th = header.map(c => `<th>${inline(c)}</th>`).join('')
  const trs = body.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>\n`
}

// ProseMirror may escape the [ as \[ — handle both
const CALLOUT_RE = /^\\?\[!([\w]+)\](?:\s+(.+))?$/
const CALLOUT_TYPES: Record<string, string> = {
  note: 'note', info: 'note', tip: 'tip', hint: 'tip', success: 'tip',
  warning: 'warning', caution: 'warning', danger: 'danger', error: 'danger', bug: 'danger',
  important: 'important', example: 'example', quote: 'quote', abstract: 'quote',
}

export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  let html = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Display math block: $$ ... $$ (either single line or multiline)
    if (line.trimStart().startsWith('$$')) {
      const rest = line.trimStart().slice(2).trimEnd()
      if (rest.endsWith('$$') && rest.length > 0) {
        // Single-line: $$ expr $$
        html += `<div class="math-block">\\[${rest.slice(0, -2).trim()}\\]</div>\n`
        i++; continue
      }
      // Multiline: opening $$ on its own line
      if (rest === '') {
        const mathLines: string[] = []
        i++
        while (i < lines.length && !lines[i].trimStart().startsWith('$$')) {
          mathLines.push(lines[i]); i++
        }
        html += `<div class="math-block">\\[${mathLines.join('\n')}\\]</div>\n`
        i++; continue
      }
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = esc(line.slice(3).trim())
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      html += `<pre><code${lang ? ` class="language-${lang}"` : ''}>${esc(codeLines.join('\n'))}</code></pre>\n`
      i++; continue
    }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)$/)
    if (hm) { html += `<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>\n`; i++; continue }

    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) { html += '<hr>\n'; i++; continue }

    // Blockquote (with callout detection)
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && (lines[i].startsWith('>') || lines[i] === '')) {
        if (lines[i] === '') { quoteLines.push(''); i++; break }
        quoteLines.push(lines[i].replace(/^>\s?/, '')); i++
      }
      const first = quoteLines[0]?.trim() ?? ''
      const cm = first.match(CALLOUT_RE)
      if (cm) {
        const type = CALLOUT_TYPES[cm[1].toLowerCase()] ?? 'note'
        const title = cm[2] ?? cm[1].charAt(0).toUpperCase() + cm[1].slice(1)
        const body = markdownToHtml(quoteLines.slice(1).join('\n'))
        html += `<div class="callout callout-${type}"><div class="callout-title">${esc(title)}</div>${body}</div>\n`
      } else {
        html += `<blockquote>${markdownToHtml(quoteLines.join('\n'))}</blockquote>\n`
      }
      continue
    }

    // Task list item
    if (/^-\s\[[ xX]\]/.test(line)) {
      const done = /\[x\]/i.test(line)
      const text = line.replace(/^-\s\[[ xX]\]\s*/, '')
      html += `<div class="task-item"><input type="checkbox"${done ? ' checked' : ''} disabled>${inline(text)}</div>\n`
      i++; continue
    }

    // Unordered list
    if (/^[*+-]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[*+-]\s/.test(lines[i])) { items.push(lines[i].replace(/^[*+-]\s/, '')); i++ }
      html += `<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>\n`; continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++ }
      html += `<ol>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ol>\n`; continue
    }

    // Table
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) { tableLines.push(lines[i]); i++ }
      html += renderTable(tableLines); continue
    }

    // Blank line
    if (line.trim() === '') { html += '\n'; i++; continue }

    // Paragraph
    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^#{1,6}\s/.test(lines[i]) && !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') && !/^[*+-]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) && !/^[-*_]{3,}$/.test(lines[i].trim()) &&
      !lines[i].trimStart().startsWith('$$')) {
      para.push(lines[i]); i++
    }
    if (para.length) html += `<p>${inline(para.join(' '))}</p>\n`
  }

  return html
}

const BANNER_INTERNAL_KEYS = new Set(['banner', 'banner_x', 'banner_y'])

export function noteToStyledHtml(note: {
  title: string; content: string; tags: string[];
  createdAt: string; updatedAt: string;
  userFrontmatter?: Record<string, unknown>
}): string {
  const body = markdownToHtml(note.content)
  const tags = note.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join(' ')

  // Banner: convert Tauri asset:// → file:// so it works when opened in browser
  const rawBanner = note.userFrontmatter?.banner as string | undefined
  const bannerSrc = rawBanner?.replace(/^asset:\/\/localhost/, 'file://')

  // User properties excluding internal banner keys
  const propEntries = Object.entries(note.userFrontmatter ?? {})
    .filter(([k]) => !BANNER_INTERNAL_KEYS.has(k))
  const propsHtml = propEntries.length > 0
    ? `<table class="props-table">${propEntries.map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : String(v ?? '')
        return `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`
      }).join('')}</table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(note.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"
  onload="renderMathInElement(document.body,{delimiters:[{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false}],throwOnError:false})"></script>
<style>
:root{--bg:#0f0f11;--surface:#1a1a1f;--text:#e2e2e6;--text2:#a0a0a8;--text3:#666;--accent:#7c6af5;--border:rgba(255,255,255,.08);--code-bg:#161618}
@media(prefers-color-scheme:light){:root{--bg:#fafafa;--surface:#f0f0f2;--text:#111;--text2:#555;--text3:#999;--accent:#5c4fd9;--border:rgba(0,0,0,.08);--code-bg:#ebebed}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.7}
.container{max-width:720px;margin:0 auto;padding:3rem 2rem 5rem}
h1{font-size:2rem;font-weight:700;line-height:1.2;margin-bottom:.5rem}
h2{font-size:1.4rem;font-weight:600;margin:2rem 0 .6rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)}
h3{font-size:1.15rem;font-weight:600;margin:1.6rem 0 .4rem}
h4,h5,h6{font-size:1rem;font-weight:600;margin:1.4rem 0 .3rem}
p{margin-bottom:1rem;color:var(--text)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
strong{font-weight:600}em{font-style:italic}s{opacity:.6}
code{background:var(--code-bg);border-radius:4px;padding:.1em .4em;font-size:.875em;font-family:'Fira Code','Cascadia Code','JetBrains Mono',monospace;color:var(--accent)}
pre{background:var(--code-bg);border-radius:8px;padding:1rem 1.25rem;overflow-x:auto;margin-bottom:1.25rem;border:1px solid var(--border)}
pre code{background:none;padding:0;color:var(--text);font-size:.85rem;line-height:1.65}
blockquote{border-left:3px solid var(--accent);padding:.4rem 0 .4rem 1rem;margin:1rem 0;color:var(--text2)}
ul,ol{margin-bottom:1rem;padding-left:1.75rem}li{margin-bottom:.3rem;line-height:1.65}
hr{border:none;border-top:1px solid var(--border);margin:2rem 0}
table{width:100%;border-collapse:collapse;margin-bottom:1.25rem;font-size:.9rem}
th{padding:.55rem .75rem;text-align:left;font-weight:600;border-bottom:2px solid var(--border);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text2)}
td{padding:.55rem .75rem;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
img{max-width:100%;border-radius:6px;margin:1rem 0;display:block}
.task-item{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.35rem}
.task-item input{accent-color:var(--accent)}
.wikilink{color:var(--accent);opacity:.8}
.callout{border-radius:8px;padding:.9rem 1rem;margin:1rem 0;border-left:4px solid}
.callout p:last-child{margin-bottom:0}
.callout-note{background:rgba(96,165,250,.07);border-color:#60a5fa}
.callout-tip{background:rgba(52,211,153,.07);border-color:#34d399}
.callout-warning{background:rgba(251,191,36,.07);border-color:#fbbf24}
.callout-danger{background:rgba(248,113,113,.07);border-color:#f87171}
.callout-important{background:rgba(167,139,250,.07);border-color:#a78bfa}
.callout-example{background:rgba(156,163,175,.07);border-color:#9ca3af}
.callout-quote{background:rgba(156,163,175,.07);border-color:#9ca3af}
.callout-title{font-weight:600;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem;opacity:.85}
.math-block{overflow-x:auto;margin:1.25rem 0;text-align:center;font-size:1.05em}
.math-inline{font-size:.95em}
.meta{margin-bottom:1rem;font-size:.8rem;color:var(--text3);display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
.tag{background:rgba(124,106,245,.12);color:var(--accent);padding:.1em .6em;border-radius:999px;font-size:.75rem}
.banner{width:100%;max-height:280px;object-fit:cover;border-radius:10px;margin-bottom:1.5rem;display:block}
.props-table{width:auto;margin-bottom:1.5rem;font-size:.82rem;border-collapse:collapse}
.props-table th{padding:.3rem .75rem .3rem 0;text-align:left;font-weight:500;color:var(--text3);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;border:none;width:1%;white-space:nowrap}
.props-table td{padding:.3rem .75rem .3rem .5rem;color:var(--text2);border:none;border-bottom:none}
.props-table tr{border-bottom:1px solid var(--border)}
.props-table tr:last-child{border-bottom:none}
</style>
</head>
<body>
<div class="container">
${bannerSrc ? `<img src="${esc(bannerSrc)}" alt="" class="banner">` : ''}
<h1>${esc(note.title)}</h1>
<div class="meta">${tags}<span>Updated ${note.updatedAt.slice(0, 10)}</span></div>
${propsHtml}
${body}
</div>
</body>
</html>`
}
