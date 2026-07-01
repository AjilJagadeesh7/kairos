import { $prose } from '@milkdown/utils'
import { inputRules, InputRule } from '@milkdown/prose/inputrules'
import { keymap } from '@milkdown/prose/keymap'
import type { EditorState, Transaction } from '@milkdown/prose/state'

// Matches [text](url) when user types the closing ) themselves
const LINK_RE = /\[([^[\]]+)\]\(([^()]+)\)$/

// Scan for any [text](url) whose span contains the cursor
const LINK_SCAN = /\[([^[\]]+)\]\(([^()]*)\)/g

function convertLinkAtCursor(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  insertAfter?: string,
): boolean {
  const { from, to } = state.selection
  if (from !== to) return false

  const $pos   = state.doc.resolve(from)
  const bStart = $pos.start()
  const bEnd   = $pos.end()
  const text   = state.doc.textBetween(bStart, bEnd, '\0', '\0')
  const offset = from - bStart

  LINK_SCAN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = LINK_SCAN.exec(text)) !== null) {
    const mStart = m.index
    const mEnd   = m.index + m[0].length
    if (offset < mStart || offset > mEnd) continue

    const [, linkText, href] = m
    if (!href.trim()) return false

    const linkType = state.schema.marks['link']
    if (!linkType) return false

    if (dispatch) {
      const absStart = bStart + mStart
      const absEnd   = bStart + mEnd
      const mark     = linkType.create({ href: href.trim(), title: null })
      const tr = state.tr.replaceWith(absStart, absEnd, state.schema.text(linkText, [mark]))
      if (insertAfter) tr.insertText(insertAfter, absStart + linkText.length)
      dispatch(tr.scrollIntoView())
    }
    return true
  }
  return false
}

// Plugin 1 — input rule: fires when user types ) themselves
export const linkInputRulePlugin = $prose(() =>
  inputRules({
    rules: [
      new InputRule(LINK_RE, (state, match, start, end) => {
        const linkType = state.schema.marks['link']
        if (!linkType || !match[2]) return null
        const mark = linkType.create({ href: match[2], title: null })
        return state.tr.replaceWith(start, end, state.schema.text(match[1], [mark]))
      }),
    ],
  }),
)

// Plugin 2 — keymap: fires on Space/Enter when closing ) was pre-inserted
export const linkKeymapPlugin = $prose(() =>
  keymap({
    ' ':     (state, dispatch) => convertLinkAtCursor(state, dispatch, ' '),
    'Enter': (state, dispatch) => convertLinkAtCursor(state, dispatch),
  }),
)
