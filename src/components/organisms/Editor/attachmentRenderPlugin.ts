import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import {
  isAttachmentRef,
  parseAttachmentRef,
  kindFromName,
  resolveAttachment,
} from '../../../attachments/attachmentService'
import { makeMediaWidget, type MediaWidget } from './attachmentWidgets'
import type { AttachmentOwner } from '../../../types'

export type GetOwner = () => AttachmentOwner | undefined

const IMG_REF_ATTR = 'data-attachment-ref'
const IMG_DONE_ATTR = 'data-attachment-resolved'

// Inline placeholder shown when an image attachment can't be found (e.g. synced
// from another device with no local copy yet). Keeps the layout from breaking.
const MISSING_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120"><rect width="100%" height="100%" fill="#3a3a3f" rx="8"/><text x="50%" y="50%" fill="#9a9aa2" font-family="sans-serif" font-size="13" text-anchor="middle" dominant-baseline="middle">Attachment unavailable</text></svg>',
  )

const isImageNode = (node: ProseNode) =>
  node.type.name === 'image' || node.type.name === 'image-block'

// ── Images: keep Crepe's native node, just resolve attachment:// src → real URL ──
function resolveImages(root: HTMLElement, getOwner: GetOwner): void {
  const owner = getOwner()
  if (!owner) return
  root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const ref = img.getAttribute(IMG_REF_ATTR) ?? img.getAttribute('src')
    if (!isAttachmentRef(ref)) return
    const parsed = parseAttachmentRef(ref!)
    if (!parsed || kindFromName(parsed.filename) !== 'image') return
    img.setAttribute(IMG_REF_ATTR, ref!)
    if (img.getAttribute(IMG_DONE_ATTR) === ref) return
    void resolveAttachment(owner, parsed.filename).then((url) => {
      img.src = url ?? MISSING_IMG
      img.setAttribute(IMG_DONE_ATTR, ref!)
    })
  })
}

// ── Video / audio / pdf / generic: hide the node, render a player widget ──
function buildDecorations(doc: ProseNode, map: Map<string, MediaWidget>, getOwner: GetOwner): DecorationSet {
  const owner = getOwner()
  const decos: Decoration[] = []
  const active = new Set<string>()

  doc.descendants((node, pos) => {
    if (!isImageNode(node)) return
    const ref = node.attrs.src as string | undefined
    if (!isAttachmentRef(ref)) return
    const parsed = parseAttachmentRef(ref!)
    if (!parsed) return
    const kind = kindFromName(parsed.filename)
    if (kind === 'image') return // handled by resolveImages

    const key = `${pos}:${ref}`
    active.add(key)
    decos.push(Decoration.node(pos, pos + node.nodeSize, { style: 'display:none' }))

    let widget = map.get(key)
    if (!widget) {
      widget = makeMediaWidget(kind, parsed.filename)
      map.set(key, widget)
      if (owner) {
        void resolveAttachment(owner, parsed.filename).then((url) => widget!.setUrl(url))
      }
    }
    decos.push(Decoration.widget(pos, widget.dom, { key, side: -1 }))
  })

  for (const [key, widget] of map) {
    if (!active.has(key)) {
      widget.cleanup()
      map.delete(key)
    }
  }
  return DecorationSet.create(doc, decos)
}

/**
 * Resolves `attachment://` references at display time. Images keep Crepe's
 * native image node (src is swapped in the DOM); video/audio/pdf are hidden and
 * replaced with an inline player widget. The ProseMirror doc — and therefore the
 * serialized markdown — keeps the portable `attachment://` ref untouched.
 */
export function attachmentRenderPlugin(getOwner: GetOwner) {
  const pluginKey = new PluginKey<DecorationSet>('attachment-render')
  return $prose(() => {
    const map = new Map<string, MediaWidget>()
    return new Plugin<DecorationSet>({
      key: pluginKey,
      state: {
        init: (_, { doc }) => buildDecorations(doc, map, getOwner),
        apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc, map, getOwner) : old),
      },
      props: { decorations(state) { return pluginKey.getState(state) } },
      view(editorView) {
        resolveImages(editorView.dom as HTMLElement, getOwner)
        return {
          update(view) { resolveImages(view.dom as HTMLElement, getOwner) },
          destroy() { map.forEach((w) => w.cleanup()); map.clear() },
        }
      },
    })
  })
}
