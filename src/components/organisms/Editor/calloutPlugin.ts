/**
 * Callout block plugin for Milkdown/ProseMirror.
 *
 * Obsidian callout syntax:
 *   > [!NOTE]
 *   > [!WARNING] Custom title
 *   > Content…
 *
 * Uses both the Decoration API and a direct DOM view.update pass so the
 * styling is applied regardless of which render path ProseMirror takes.
 */
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import type { Node } from '@milkdown/prose/model'
import { dynamicTypeMap } from './calloutRegistry'

// Maps every recognised alias to a canonical type used as a CSS class suffix
const TYPE_MAP: Record<string, string> = {
  note:     'note',  info:     'note',
  tip:      'tip',   hint:     'tip',   success: 'tip',
  important:'important',
  warning:  'warning', caution: 'warning',
  danger:   'danger',  bug:     'danger', error:   'danger',
  example:  'example',
  quote:    'quote',   cite:    'quote',
  abstract: 'abstract', summary: 'abstract', tldr: 'abstract',
}

// [!TYPE] or [!TYPE Custom title here]
const CALLOUT_RE = /^\[!([A-Za-z]+)(?:\s.*)?\]/

function resolveType(raw: string): string | null {
  return TYPE_MAP[raw] ?? dynamicTypeMap[raw] ?? null
}

function getCalloutType(bq: Element): string | null {
  const firstP = bq.querySelector(':scope > p:first-child')
  if (!firstP) return null
  const text = (firstP.textContent ?? '').trimStart()
  const match = CALLOUT_RE.exec(text)
  if (!match) return null
  // Same fallback as buildDecorations, so the two passes never disagree.
  return resolveType(match[1].toLowerCase()) ?? 'note'
}

/**
 * Directly stamp callout classes on blockquote DOM elements. Touches an
 * element only when its classes are actually wrong: every class change is a
 * DOM mutation ProseMirror observes and redraws, which triggers this pass
 * again — unconditional remove/re-add looped every frame, re-creating the
 * nodes and swallowing clicks and selections in any note with a callout.
 */
function stampCallouts(editorDom: Element) {
  const titles = new Set<Element>()

  for (const bq of editorDom.querySelectorAll('blockquote')) {
    const canonical = getCalloutType(bq)
    const wanted = canonical ? ['callout', `callout-${canonical}`] : []
    for (const cls of [...bq.classList]) {
      if ((cls === 'callout' || cls.startsWith('callout-')) && !wanted.includes(cls)) bq.classList.remove(cls)
    }
    for (const cls of wanted) if (!bq.classList.contains(cls)) bq.classList.add(cls)
    const el = bq as HTMLElement
    if (canonical && el.dataset.callout !== canonical) el.dataset.callout = canonical
    if (!canonical && el.dataset.callout !== undefined) delete el.dataset.callout

    const firstP = canonical ? bq.querySelector(':scope > p:first-child') : null
    if (firstP) titles.add(firstP)
  }

  for (const p of editorDom.querySelectorAll('.callout-title')) if (!titles.has(p)) p.classList.remove('callout-title')
  for (const p of titles) if (!p.classList.contains('callout-title')) p.classList.add('callout-title')
}

function buildDecorations(doc: Node): DecorationSet {
  const decos: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return

    const first = node.firstChild
    if (!first || first.type.name !== 'paragraph') return

    const rawText = first.textContent
    const trimmed = rawText.trimStart()
    const match = CALLOUT_RE.exec(trimmed)
    if (!match) return

    const canonical = resolveType(match[1].toLowerCase()) ?? 'note'

    decos.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: `callout callout-${canonical}`,
        'data-callout': canonical,
      }),
    )

    // Mark the title paragraph
    decos.push(Decoration.node(pos + 1, pos + 1 + first.nodeSize, { class: 'callout-title' }))

    // Dim the [!TYPE] marker token (kept in the flow — hiding it with
    // display:none breaks caret placement and scrambles text while typing).
    const leadingSpaces = rawText.length - trimmed.length
    const markerStart = pos + 2 + leadingSpaces
    decos.push(Decoration.inline(markerStart, markerStart + match[0].length, { class: 'callout-marker' }))

    return false
  })

  return DecorationSet.create(doc, decos)
}

const key = new PluginKey<DecorationSet>('callout-blocks')

export const calloutPlugin = $prose(() =>
  new Plugin<DecorationSet>({
    key,
    state: {
      init:  (_, { doc }) => buildDecorations(doc),
      apply: (tr, old)    => (tr.docChanged ? buildDecorations(tr.doc) : old),
    },
    props: {
      decorations(state) { return key.getState(state) },
    },
    view(editorView) {
      // Direct DOM pass as a belt-and-suspenders fallback — runs after every
      // ProseMirror update so classes are always present even if the Decoration
      // API doesn't apply them in a given render cycle.
      let raf: number | null = null
      const run = () => { raf = null; stampCallouts(editorView.dom) }
      return {
        update() {
          if (raf !== null) cancelAnimationFrame(raf)
          raf = requestAnimationFrame(run)
        },
        destroy() {
          if (raf !== null) cancelAnimationFrame(raf)
        },
      }
    },
  }),
)
