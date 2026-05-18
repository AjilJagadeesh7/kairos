import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { TransclusionEmbed } from './TransclusionEmbed'

// ![[title]] — transclusion (embed note content inline)
const TRANSCLUSION_RE = /!\[\[([^\]]+)\]\]/g

// [[title]] — regular wikilink; negative lookbehind ensures we don't match transclusions
const WIKILINK_RE = /(?<!!)(\[\[([^\]]+)\]\])/g

type TcEntry = { dom: HTMLElement; root: Root }

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  tcMap: Map<string, TcEntry>,
): DecorationSet {
  const decos: Decoration[] = []
  const activeKeys = new Set<string>()

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    // ── Transclusions: ![[title]] ──────────────────────────────────────────
    TRANSCLUSION_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TRANSCLUSION_RE.exec(node.text)) !== null) {
      const title = m[1].trim()
      const start = pos + m.index
      const end   = start + m[0].length
      const key   = `tc:${title}:${start}`
      activeKeys.add(key)

      // Hide the raw ![[title]] text in the editor
      decos.push(Decoration.inline(start, end, { class: 'transclusion-raw', nodeName: 'span' }))

      // Reuse or create the React widget mount
      let entry = tcMap.get(key)
      if (!entry) {
        const dom = document.createElement('div')
        dom.className = 'transclusion-widget'
        dom.setAttribute('contenteditable', 'false')
        const root = createRoot(dom)
        root.render(createElement(TransclusionEmbed, { title }))
        entry = { dom, root }
        tcMap.set(key, entry)
      }

      // side: -1 places the widget just before the (now-hidden) raw text
      decos.push(Decoration.widget(start, entry.dom, { key, side: -1 }))
    }

    // ── Regular wikilinks: [[title]] ──────────────────────────────────────
    WIKILINK_RE.lastIndex = 0
    while ((m = WIKILINK_RE.exec(node.text)) !== null) {
      decos.push(
        Decoration.inline(
          pos + m.index,
          pos + m.index + m[0].length,
          { class: 'wikilink-token', nodeName: 'span' },
        ),
      )
    }
  })

  // Unmount React roots for transclusions that were removed from the document
  for (const [key, { root }] of tcMap) {
    if (!activeKeys.has(key)) {
      root.unmount()
      tcMap.delete(key)
    }
  }

  return DecorationSet.create(doc, decos)
}

const key = new PluginKey<DecorationSet>('wikilink-highlight')

export const wikilinkHighlightPlugin = $prose(() => {
  const tcMap = new Map<string, TcEntry>()

  return new Plugin<DecorationSet>({
    key,
    state: {
      init:  (_, { doc }) => buildDecorations(doc, tcMap),
      apply: (tr, old)    => (tr.docChanged ? buildDecorations(tr.doc, tcMap) : old),
    },
    props: {
      decorations(state) { return key.getState(state) },
    },
    view() {
      return {
        destroy() {
          // Clean up all React roots when the editor is destroyed
          tcMap.forEach(({ root }) => root.unmount())
          tcMap.clear()
        },
      }
    },
  })
})
