/**
 * Fetched HTML → the page's main text as plain markdown. Scripts, styles,
 * navigation, forms and anything hidden (hidden attribute, aria-hidden,
 * display:none, zero-size text…) are dropped first: hidden text is a common
 * place to plant instructions for AI readers. What remains is still treated
 * as untrusted data.
 */
const DROP = 'script,style,noscript,template,svg,canvas,iframe,object,embed,nav,footer,aside,form,button,input,select,textarea,dialog,[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"]'
const HIDDEN_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?![.\d])|opacity\s*:\s*0(?![.\d])|(?:width|height)\s*:\s*0(?:px)?\s*;|left\s*:\s*-\d{3,}px|clip\s*:\s*rect\(0/i
const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'TABLE', 'TR', 'UL', 'OL', 'DL', 'DT', 'DD', 'PRE'])

export interface Extracted { title: string; text: string }

function walk(node: Node, out: string[]): void {
  if (node.nodeType === 3) { out.push((node.textContent ?? '').replace(/\s+/g, ' ')); return }
  if (node.nodeType !== 1) return // comments and the rest are dropped
  const el = node as Element
  const tag = el.tagName
  if (/^H[1-6]$/.test(tag)) { out.push(`\n\n${'#'.repeat(Number(tag[1]))} ${(el.textContent ?? '').replace(/\s+/g, ' ').trim()}\n\n`); return }
  if (tag === 'BR') { out.push('\n'); return }
  if (tag === 'PRE') { out.push(`\n\n\`\`\`\n${el.textContent ?? ''}\n\`\`\`\n\n`); return }
  if (tag === 'LI') out.push('\n- ')
  else if (tag === 'TD' || tag === 'TH') out.push(' | ')
  else if (BLOCK.has(tag)) out.push('\n\n')
  for (const child of [...el.childNodes]) walk(child, out)
  if (BLOCK.has(tag)) out.push('\n\n')
}

export function extractMain(html: string, parse: (h: string) => Document = (h) => new DOMParser().parseFromString(h, 'text/html')): Extracted {
  const doc = parse(html)
  const title = (doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? doc.title ?? '').trim()
    || (doc.querySelector('h1')?.textContent ?? '').trim()
  for (const el of [...doc.querySelectorAll(DROP)]) el.remove()
  for (const el of [...doc.querySelectorAll('[style]')]) if (HIDDEN_STYLE.test(el.getAttribute('style') ?? '')) el.remove()
  const root = doc.querySelector('article') ?? doc.querySelector('main, [role="main"]') ?? doc.body
  const out: string[] = []
  if (root) walk(root, out)
  const text = out.join('')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title, text }
}

/** Plain text pages are kept as they are, minus control characters. */
export function looksLikeHtml(body: string): boolean {
  return /^\s*(?:<!doctype html|<html|<head|<body)|<\/(?:p|div|body)>/i.test(body.slice(0, 2000))
}
