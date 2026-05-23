import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

// Signatures that indicate paste from Office / Google Docs / similar rich editors.
// For those sources we strip all HTML and paste plain text only — their HTML
// is full of inline styles, namespaced attributes and deeply nested tables that
// produce garbage in ProseMirror.
const HOSTILE_HTML_PATTERNS = [
  /urn:schemas-microsoft-com/i,   // Word / Excel
  /google-docs/i,                  // Google Docs
  /mso-/i,                         // MS Office styles
  /<o:p/i,                         // Word paragraph tags
  /xmlns:o=/i,                     // Office XML namespace
]

function isHostileHTML(html: string): boolean {
  return HOSTILE_HTML_PATTERNS.some(re => re.test(html))
}

function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  // Preserve newlines at block boundaries
  div.querySelectorAll('p, div, br, li, tr').forEach(el => {
    el.after(document.createTextNode('\n'))
  })
  return (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

const pasteSanitizeKey = new PluginKey('pasteSanitize')

export const pasteSanitizePlugin = $prose(
  () =>
    new Plugin({
      key: pasteSanitizeKey,
      props: {
        handlePaste(view, event) {
          const clipboardData = event.clipboardData
          if (!clipboardData) return false

          const html = clipboardData.getData('text/html')
          if (!html || !isHostileHTML(html)) return false   // let ProseMirror handle it

          // Prevent the default paste then re-dispatch as plain text
          event.preventDefault()
          const plain = htmlToPlainText(html) || clipboardData.getData('text/plain')
          if (!plain) return true

          const { state, dispatch } = view
          const tr = state.tr.insertText(plain, state.selection.from, state.selection.to)
          dispatch(tr.scrollIntoView())
          return true
        },
      },
    }),
)
