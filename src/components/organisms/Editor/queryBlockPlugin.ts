import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { QueryBlock } from './QueryBlock'

type QbEntry = { dom: HTMLElement; root: Root; query: string }

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  qbMap: Map<string, QbEntry>,
): DecorationSet {
  const decos: Decoration[] = []
  const activeKeys = new Set<string>()

  doc.descendants((node, pos) => {
    // Match fenced code blocks with language === 'query'
    if (node.type.name !== 'code_block') return
    if (node.attrs.language !== 'query') return

    const query = node.textContent ?? ''
    const key = `qb:${pos}`
    activeKeys.add(key)

    // Hide the original code_block node
    decos.push(
      Decoration.node(pos, pos + node.nodeSize, { style: 'display:none' }),
    )

    // Reuse existing widget or create a new one
    let entry = qbMap.get(key)
    if (!entry) {
      const dom = document.createElement('div')
      dom.className = 'query-block-widget'
      dom.setAttribute('contenteditable', 'false')
      const root = createRoot(dom)
      root.render(createElement(QueryBlock, { query }))
      entry = { dom, root, query }
      qbMap.set(key, entry)
    } else if (entry.query !== query) {
      // Query content changed — re-render with new props
      entry.root.render(createElement(QueryBlock, { query }))
      entry.query = query
    }

    decos.push(Decoration.widget(pos, entry.dom, { key, side: -1 }))
  })

  // Unmount React roots for query blocks removed from the document
  for (const [key, { root }] of qbMap) {
    if (!activeKeys.has(key)) {
      root.unmount()
      qbMap.delete(key)
    }
  }

  return DecorationSet.create(doc, decos)
}

const key = new PluginKey<DecorationSet>('query-block')

export const queryBlockPlugin = $prose(() => {
  const qbMap = new Map<string, QbEntry>()

  return new Plugin<DecorationSet>({
    key,
    state: {
      init:  (_, { doc }) => buildDecorations(doc, qbMap),
      apply: (tr, old)    => (tr.docChanged ? buildDecorations(tr.doc, qbMap) : old),
    },
    props: {
      decorations(state) { return key.getState(state) },
    },
    view() {
      return {
        destroy() {
          qbMap.forEach(({ root }) => root.unmount())
          qbMap.clear()
        },
      }
    },
  })
})
