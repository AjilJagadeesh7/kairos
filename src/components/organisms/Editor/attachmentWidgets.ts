import type { AttachmentKind } from '../../../types'

/** A media widget rendered as a ProseMirror decoration (pure DOM, no React). */
export interface MediaWidget {
  dom: HTMLElement
  /** Swap in the resolved (loadable) URL once it's available. */
  setUrl: (url: string | null) => void
  cleanup: () => void
}

const WRAP_STYLE = [
  'margin:10px 0',
  'display:block',
  'box-sizing:border-box',
].join(';')

const CARD_STYLE = [
  'border:1px solid rgb(var(--border))',
  'background:rgb(var(--surface-2))',
  'border-radius:10px',
  'overflow:hidden',
].join(';')

function caption(filename: string): HTMLElement {
  const el = document.createElement('div')
  el.textContent = filename
  el.style.cssText = [
    'padding:6px 10px',
    'font-size:11px',
    'color:rgb(var(--text-3))',
    'border-top:1px solid rgb(var(--border))',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';')
  return el
}

function placeholder(label: string): HTMLElement {
  const el = document.createElement('div')
  el.textContent = label
  el.style.cssText = 'padding:20px;font-size:12px;color:rgb(var(--text-3));text-align:center'
  return el
}

export function makeMediaWidget(kind: AttachmentKind, filename: string): MediaWidget {
  const dom = document.createElement('div')
  dom.contentEditable = 'false'
  dom.className = 'mv-attachment'
  dom.style.cssText = WRAP_STYLE

  const card = document.createElement('div')
  card.style.cssText = CARD_STYLE
  dom.appendChild(card)

  const hole = placeholder('Loading…')
  card.appendChild(hole)
  card.appendChild(caption(filename))

  let mediaEl: HTMLMediaElement | HTMLIFrameElement | HTMLAnchorElement | null = null

  const setUrl = (url: string | null) => {
    hole.remove()
    if (mediaEl) mediaEl.remove()
    if (!url) {
      card.insertBefore(placeholder('File unavailable'), card.firstChild)
      return
    }

    if (kind === 'video') {
      const v = document.createElement('video')
      v.controls = true
      v.preload = 'metadata'
      v.src = url
      v.style.cssText = 'display:block;width:100%;max-height:70vh;background:#000'
      mediaEl = v
    } else if (kind === 'audio') {
      const a = document.createElement('audio')
      a.controls = true
      a.src = url
      a.style.cssText = 'display:block;width:100%;padding:10px;box-sizing:border-box'
      mediaEl = a
    } else if (kind === 'pdf') {
      const f = document.createElement('iframe')
      f.src = url
      f.title = filename
      f.style.cssText = 'display:block;width:100%;height:520px;border:0;background:#fff'
      mediaEl = f
    } else {
      const link = document.createElement('a')
      link.href = url
      link.textContent = `Open ${filename}`
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.style.cssText = 'display:block;padding:16px;font-size:13px;color:rgb(var(--accent));text-decoration:none'
      mediaEl = link
    }
    card.insertBefore(mediaEl, card.lastChild)
  }

  const cleanup = () => {
    if (mediaEl && 'pause' in mediaEl) {
      try { (mediaEl as HTMLMediaElement).pause() } catch { /* ignore */ }
    }
  }

  return { dom, setUrl, cleanup }
}
