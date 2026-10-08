import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

// Inline preview of an AI suggestion: the text it would replace is struck
// through and the proposal is shown right after it, highlighted. Purely
// visual — the document is untouched until the user presses Accept in the
// bubble. The range is mapped through every edit so Accept lands in the
// right place even if the user keeps typing elsewhere.

export interface SuggestionPreview {
  id: number
  from: number
  to: number
  /** Plain text of the range when the preview was shown. */
  originalText: string
  proposed: string
}

export type SuggestionMeta = { type: 'show'; preview: SuggestionPreview } | { type: 'clear' }

export const aiSuggestionKey = new PluginKey<SuggestionPreview | null>('kairosAiSuggestion')

function widget(proposed: string): HTMLElement {
  const el = document.createElement('span')
  el.className = 'ai-suggest-ins'
  el.textContent = proposed
  return el
}

export const aiSuggestionPlugin = $prose(() => new Plugin<SuggestionPreview | null>({
  key: aiSuggestionKey,
  state: {
    init: () => null,
    apply(tr, value) {
      const meta = tr.getMeta(aiSuggestionKey) as SuggestionMeta | undefined
      if (meta?.type === 'show') return meta.preview
      if (meta?.type === 'clear') return null
      if (!value || !tr.docChanged) return value
      const from = tr.mapping.map(value.from, value.from === value.to ? -1 : 1)
      const to = Math.max(from, tr.mapping.map(value.to, -1))
      return { ...value, from, to }
    },
  },
  props: {
    decorations(state) {
      const p = aiSuggestionKey.getState(state)
      if (!p) return null
      const decos: Decoration[] = []
      if (p.to > p.from) decos.push(Decoration.inline(p.from, p.to, { class: 'ai-suggest-del' }))
      decos.push(Decoration.widget(p.to, () => widget(p.proposed), {
        side: 1, key: `ai-suggest-${p.id}`, ignoreSelection: true,
      }))
      return DecorationSet.create(state.doc, decos)
    },
  },
}))
