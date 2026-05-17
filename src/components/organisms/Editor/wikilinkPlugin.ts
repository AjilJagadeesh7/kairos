import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

function buildDecorations(doc: Parameters<typeof DecorationSet.create>[0]): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    WIKILINK_RE.lastIndex = 0
    let m: RegExpExecArray | null
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
  return DecorationSet.create(doc, decos)
}

const key = new PluginKey<DecorationSet>('wikilink-highlight')

export const wikilinkHighlightPlugin = $prose(() =>
  new Plugin<DecorationSet>({
    key,
    state: {
      init:  (_, { doc }) => buildDecorations(doc),
      apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old),
    },
    props: {
      decorations(state) { return key.getState(state) },
    },
  }),
)
