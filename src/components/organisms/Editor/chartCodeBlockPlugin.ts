import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { ChartBlock } from './ChartBlock'

type Entry = { dom: HTMLElement; root: Root; code: string }

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  map: Map<string, Entry>,
): DecorationSet {
  const decos: Decoration[] = []
  const activeKeys = new Set<string>()

  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return
    if (node.attrs.language !== 'chart') return

    const code = node.textContent ?? ''
    const key  = `chart:${pos}`
    activeKeys.add(key)

    // Hide the raw code block
    decos.push(Decoration.node(pos, pos + node.nodeSize, { style: 'display:none' }))

    let entry = map.get(key)
    if (!entry) {
      const dom = document.createElement('div')
      dom.className = 'chart-block-widget'
      dom.setAttribute('contenteditable', 'false')
      const root = createRoot(dom)
      root.render(createElement(ChartBlock, { code }))
      entry = { dom, root, code }
      map.set(key, entry)
    } else if (entry.code !== code) {
      entry.root.render(createElement(ChartBlock, { code }))
      entry.code = code
    }

    decos.push(Decoration.widget(pos, entry.dom, { key, side: -1 }))
  })

  // Clean up removed entries
  for (const [key, { root }] of map) {
    if (!activeKeys.has(key)) {
      root.unmount()
      map.delete(key)
    }
  }

  return DecorationSet.create(doc, decos)
}

const pluginKey = new PluginKey<DecorationSet>('chart-code-block')

export const chartCodeBlockPlugin = $prose(() => {
  const map = new Map<string, Entry>()

  return new Plugin<DecorationSet>({
    key: pluginKey,
    state: {
      init:  (_, { doc }) => buildDecorations(doc, map),
      apply: (tr, old)    => (tr.docChanged ? buildDecorations(tr.doc, map) : old),
    },
    props: {
      decorations(state) { return pluginKey.getState(state) },
    },
    view() {
      return {
        destroy() {
          map.forEach(({ root }) => root.unmount())
          map.clear()
        },
      }
    },
  })
})
