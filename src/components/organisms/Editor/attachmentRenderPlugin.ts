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
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { usePaneStore } from '../../../store/usePaneStore'
import { makeMediaWidget, type MediaWidget } from './attachmentWidgets'
import type { AttachmentKind } from '../../../types'

const IMG_REF_ATTR = 'data-attachment-ref'
const IMG_DONE_ATTR = 'data-attachment-resolved'

// Small "open in Attachments" icon (external-link) shown on hover over an image.
const OPEN_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'

/** One-time stylesheet for the hover "open" affordance on attachment images. */
function injectOpenStyle(): void {
  if (typeof document === 'undefined' || document.getElementById('mv-att-open-style')) return
  const style = document.createElement('style')
  style.id = 'mv-att-open-style'
  style.textContent = [
    '.mv-att-host{position:relative}',
    '.mv-att-open{position:absolute;top:8px;right:8px;z-index:6;display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;opacity:0;transition:opacity .12s ease}',
    '.mv-att-host:hover>.mv-att-open,.mv-att-open:focus-visible{opacity:1}',
    '.mv-att-open:hover{background:rgba(0,0,0,.78)}',
  ].join('')
  document.head.appendChild(style)
}

/** Inject (once) a hover "open" button into an image's container. Direct clicks
 *  on the image itself keep their native behavior (select / resize). */
function ensureImageOpenButton(img: HTMLImageElement, id: string): void {
  const host = img.parentElement
  if (!host) return
  const existing = host.querySelector<HTMLButtonElement>(':scope > .mv-att-open')
  if (existing) { existing.dataset.attId = id; return }

  host.classList.add('mv-att-host')
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'mv-att-open'
  btn.title = 'Open in Attachments'
  btn.setAttribute('aria-label', 'Open in Attachments')
  btn.setAttribute('contenteditable', 'false')
  btn.dataset.attId = id
  btn.innerHTML = OPEN_ICON
  // Stop the editor from stealing the interaction / placing a selection.
  btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation() })
  btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openAttachment(btn.dataset.attId || id) })
  host.appendChild(btn)
}

// Inline placeholder shown when an image attachment can't be found (e.g. synced
// from another device with no local copy yet). Keeps the layout from breaking.
const MISSING_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120"><rect width="100%" height="100%" fill="#3a3a3f" rx="8"/><text x="50%" y="50%" fill="#9a9aa2" font-family="sans-serif" font-size="13" text-anchor="middle" dominant-baseline="middle">Attachment unavailable</text></svg>',
  )

const isImageNode = (node: ProseNode) =>
  node.type.name === 'image' || node.type.name === 'image-block'

/** Attachment records live in memory in the store, so kind/name lookups are sync.
 *  Falls back to the node's alt/title (the filename) for a just-inserted file
 *  the store hasn't caught up on yet. */
function nameForId(id: string, hint?: string): string {
  return useAttachmentStore.getState().attachments.find(a => a.id === id)?.name || hint || ''
}
function kindForId(id: string, hint?: string): AttachmentKind {
  const name = nameForId(id, hint)
  return name ? kindFromName(name) : 'image'
}

/** Open a referenced attachment on the Attachments page (in the focused pane). */
export function openAttachment(id: string): void {
  const { focusedPaneId, navigatePane } = usePaneStore.getState()
  navigatePane(focusedPaneId, `/attachments/${id}`)
}

// ── Images: keep Crepe's native node, resolve attachment:// src → real URL ──
function resolveImages(root: HTMLElement): void {
  injectOpenStyle()
  root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const ref = img.getAttribute(IMG_REF_ATTR) ?? img.getAttribute('src')
    if (!isAttachmentRef(ref)) return
    const id = parseAttachmentRef(ref)
    if (!id || kindForId(id, img.getAttribute('alt') ?? undefined) !== 'image') return
    img.setAttribute(IMG_REF_ATTR, ref!)

    // Hover "open" affordance near the corner — direct clicks stay native
    // (select / resize the image), so editing isn't hijacked.
    ensureImageOpenButton(img, id)

    if (img.getAttribute(IMG_DONE_ATTR) === ref) return
    void resolveAttachment(id).then((url) => {
      img.src = url ?? MISSING_IMG
      img.setAttribute(IMG_DONE_ATTR, ref!)
    })
  })
}

// ── Video / audio / pdf / generic: hide the node, render a player widget ──
function buildDecorations(doc: ProseNode, map: Map<string, MediaWidget>): DecorationSet {
  const decos: Decoration[] = []
  const active = new Set<string>()

  doc.descendants((node, pos) => {
    if (!isImageNode(node)) return
    const ref = node.attrs.src as string | undefined
    if (!isAttachmentRef(ref)) return
    const id = parseAttachmentRef(ref)
    if (!id) return
    const hint = (node.attrs.alt as string) || (node.attrs.title as string) || undefined
    const kind = kindForId(id, hint)
    if (kind === 'image') return // handled by resolveImages

    const key = `${pos}:${ref}`
    active.add(key)
    decos.push(Decoration.node(pos, pos + node.nodeSize, { style: 'display:none' }))

    let widget = map.get(key)
    if (!widget) {
      widget = makeMediaWidget(kind, nameForId(id, hint) || 'file', () => openAttachment(id))
      map.set(key, widget)
      void resolveAttachment(id).then((url) => widget!.setUrl(url))
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
 * Resolves `attachment://<id>` references at display time. Images keep Crepe's
 * native image node (src is swapped in the DOM, click opens the full file);
 * video/audio/pdf are hidden and replaced with an inline player widget. The
 * ProseMirror doc — and the serialized markdown — keeps the portable ref.
 */
export function attachmentRenderPlugin() {
  const pluginKey = new PluginKey<DecorationSet>('attachment-render')
  return $prose(() => {
    const map = new Map<string, MediaWidget>()
    return new Plugin<DecorationSet>({
      key: pluginKey,
      state: {
        init: (_, { doc }) => buildDecorations(doc, map),
        apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc, map) : old),
      },
      props: { decorations(state) { return pluginKey.getState(state) } },
      view(editorView) {
        resolveImages(editorView.dom as HTMLElement)
        return {
          update(view) { resolveImages(view.dom as HTMLElement) },
          destroy() { map.forEach((w) => w.cleanup()); map.clear() },
        }
      },
    })
  })
}
