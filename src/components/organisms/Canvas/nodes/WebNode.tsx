import { useState, useCallback, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { openExternal } from '../../../../utils/openExternal'
import { useWebPageContent } from '../../../../hooks/useWebPageContent'
import { WebReaderView } from './WebReaderView'
import { WebLinkCard } from './WebLinkCard'
import type { CanvasWebData } from '../../../../types'

const HANDLE_STYLE: React.CSSProperties = {
  width: 14, height: 14,
  background: 'rgb(var(--accent))',
  border: '2px solid rgb(var(--surface))',
  borderRadius: '50%',
  cursor: 'crosshair',
  zIndex: 10,
}

const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function normalizeUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

// YouTube watch/short URLs → embed URL so they work in iframes
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`
    }
    if (u.hostname.endsWith('youtube.com') && u.pathname === '/watch') {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    return url
  } catch {
    return url
  }
}

/**
 * Sub-resources load straight from the real origin (the proxy injects a
 * `<base>` tag), so only the top-level document is proxied.
 *
 * `allow-top-navigation` is deliberately omitted: it is what lets a page run
 * `top.location = self.location` and yank the whole app off to the site. Without
 * it, frame-busting scripts fail silently and the page stays embedded.
 */
const IFRAME_SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-downloads',
].join(' ')

// In Tauri, route iframe through the mvproxy:// scheme so Rust can strip
// X-Frame-Options / CSP frame-ancestors before the browser sees them.
function toIframeSrc(url: string): string {
  if (!IS_TAURI) return url
  // YouTube: use embed URL directly (allows iframes, no proxy needed)
  const embedded = toEmbedUrl(url)
  if (embedded !== url) return embedded
  // Everything else: proxy
  return url.replace(/^https?:\/\//, 'mvproxy://')
}

interface WebNodeData extends CanvasWebData {
  canvasId: string
  onDelete: (id: string) => void
  onDataChange: (id: string, patch: Record<string, unknown>) => void
}

export function WebNode({ id, data, selected }: NodeProps & { data: WebNodeData }) {
  const [liveUrl,  setLiveUrl]  = useState(data.url ?? '')
  const [draft,    setDraft]    = useState(data.url ?? '')
  const [editing,  setEditing]  = useState(!data.url)
  const [loading,  setLoading]  = useState(!!data.url)
  const [blocked,  setBlocked]  = useState(false)
  /**
   * Tiered display. 'page' is the live iframe; 'reader' fetches the HTML and
   * renders the extracted article, degrading to a link card when a page has no
   * prose. A site that refuses framing flips us to 'reader' automatically.
   */
  const [mode, setMode] = useState<'page' | 'reader'>('page')
  const iframeRef  = useRef<HTMLIFrameElement>(null)
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const content = useWebPageContent(liveUrl, mode === 'reader' && !editing)

  // Framing refused → fall through to reader mode rather than a dead end.
  useEffect(() => {
    if (blocked && mode === 'page') setMode('reader')
  }, [blocked, mode])


  function clearTimers() {
    if (checkTimer.current) { clearTimeout(checkTimer.current); checkTimer.current = null }
    if (blockTimer.current) { clearTimeout(blockTimer.current); blockTimer.current = null }
  }

  // Sync in when another source updates the node data
  useEffect(() => {
    if (data.url && data.url !== liveUrl) {
      setLiveUrl(data.url)
      setDraft(data.url)
      setEditing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.url])

  // On unmount: cancel timers and blank the iframe to cancel the mvproxy
  // request immediately — without this, Wikipedia keeps streaming through
  // the Rust proxy after navigation, blocking the main thread and causing
  // the app to freeze when loading graph or other pages.
  useEffect(() => {
    return () => {
      clearTimers()
      if (iframeRef.current) iframeRef.current.src = 'about:blank'
    }
  }, [])

  const commit = useCallback(() => {
    const url = normalizeUrl(draft)
    if (url) {
      setLiveUrl(url)
      setEditing(false)
      setLoading(true)
      setBlocked(false)
      setMode('page')   // every new URL gets a shot at the live page first
      data.onDataChange(id, { url })
      clearTimers()
      // Fallback: if onLoad never fires (some browsers silently drop blocked frames)
      blockTimer.current = setTimeout(() => { setLoading(false); setBlocked(true) }, 10_000)
    }
  }, [draft, id, data])

  const startEdit = useCallback(() => {
    setDraft(liveUrl)
    setEditing(true)
  }, [liveUrl])

  function handleLoad(e: React.SyntheticEvent<HTMLIFrameElement>) {
    clearTimers()
    const iframe = e.target as HTMLIFrameElement
    // Short delay then inspect contentDocument.
    // X-Frame-Options rejection → empty body (same-origin blank doc).
    // Cross-origin success → SecurityError on access → treat as loaded fine.
    // Proxy removes the header, so we should never get an empty body here in Tauri.
    checkTimer.current = setTimeout(() => {
      setLoading(false)
      try {
        const doc = iframe.contentDocument
        if (doc !== null && doc !== undefined && doc.body?.innerHTML === '') setBlocked(true)
        else setBlocked(false)
      } catch { setBlocked(false) }
    }, 200)
  }

  function handleError() {
    clearTimers()
    setLoading(false)
    setBlocked(true)
  }

  const iframeSrc = liveUrl ? toIframeSrc(liveUrl) : ''

  return (
    <div className={`relative flex h-full min-h-[240px] min-w-[320px] flex-col rounded-xl border shadow-md transition-shadow ${
      selected ? 'border-[rgb(var(--accent))] shadow-[0_0_0_2px_rgba(var(--accent),0.2)]' : 'border-[rgb(var(--border))]'
    }`}>
      <NodeResizer minWidth={320} minHeight={240} isVisible={selected} lineStyle={{ borderColor: 'rgb(var(--accent))' }} handleStyle={{ borderColor: 'rgb(var(--accent))', zIndex: 20 }} />

      <Handle type="source" position={Position.Top}    id="t" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left}   id="l" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right}  id="r" style={HANDLE_STYLE} />

      {/* Inner wrapper clips content to rounded corners without clipping resize handles */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-[rgb(var(--surface))]">

      {/* Drag handle + URL bar */}
      <div className="drag-handle flex h-8 shrink-0 cursor-grab select-none items-center gap-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 active:cursor-grabbing">
        <Icon name="grip-vertical" size={11} className="shrink-0 text-[rgb(var(--text-3))]" />
        <Icon name="globe"         size={11} className="shrink-0 text-[rgb(var(--text-3))]" />

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); commit() }
              if (e.key === 'Escape') { setEditing(false); setDraft(liveUrl) }
            }}
            onBlur={commit}
            onPointerDown={e => e.stopPropagation()}
            placeholder="https://example.com"
            className="nodrag nopan min-w-0 flex-1 bg-transparent text-[11px] text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]"
          />
        ) : (
          <button type="button" title="Click to change URL"
            onPointerDown={e => e.stopPropagation()}
            onClick={startEdit}
            className="nodrag nopan min-w-0 flex-1 truncate text-left text-[11px] text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
            {liveUrl || <span className="italic text-[rgb(var(--text-3))]">Enter URL…</span>}
          </button>
        )}

        {liveUrl && !editing && (
          <button type="button"
            title={mode === 'page' ? 'Reader view' : 'Live page'}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setMode(m => (m === 'page' ? 'reader' : 'page'))}
            className={`nodrag nopan flex h-5 w-5 shrink-0 items-center justify-center rounded transition ${
              mode === 'reader' ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]'
            }`}>
            <Icon name={mode === 'page' ? 'book-open' : 'globe'} size={11} />
          </button>
        )}

        {liveUrl && !editing && (
          <button type="button" title="Open in browser"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => void openExternal(liveUrl)}
            className="nodrag nopan flex h-5 w-5 shrink-0 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text))]">
            <Icon name="external-link" size={11} />
          </button>
        )}

        <button type="button" title="Remove"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => data.onDelete(id)}
          className="nodrag nopan flex h-5 w-5 shrink-0 items-center justify-center rounded text-[rgb(var(--text-3))] opacity-40 transition hover:text-red-400 hover:opacity-100">
          <Icon name="x" size={11} />
        </button>
      </div>

      {/* Content */}
      <div className="nodrag nopan relative flex-1 overflow-hidden">
        {/* When selected, cover the iframe so resize handles can capture pointer events.
            Without this the iframe steals mousedown and dragging the resize border breaks. */}
        {selected && liveUrl && !editing && (
          <div className="pointer-events-auto absolute inset-0 z-10" />
        )}
        {liveUrl && !editing && mode === 'reader' ? (
          /* Tier 2/3: fetched and parsed. Reader view when the page has prose,
             link card when it doesn't (search pages, dashboards, login walls)
             or when the fetch failed outright. */
          content.status === 'loading' ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[rgb(var(--surface-2))]">
              <Icon name="loader-2" size={22} className="animate-spin text-[rgb(var(--text-3))]" />
              <p className="text-[11px] text-[rgb(var(--text-3))]">Reading page…</p>
            </div>
          ) : content.status === 'ready' && content.page && content.page.blocks.length > 0 ? (
            <WebReaderView meta={content.page.meta} blocks={content.page.blocks} url={liveUrl} />
          ) : (
            <WebLinkCard
              meta={content.page?.meta ?? null}
              url={liveUrl}
              reason={content.error
                ? `Couldn't read this page: ${content.error}`
                : "This page has no readable article — it's likely an app, search or login page."}
            />
          )
        ) : liveUrl && !editing ? (
          <>
            <iframe
              ref={iframeRef}
              key={iframeSrc}
              src={iframeSrc}
              title={liveUrl}
              sandbox={IFRAME_SANDBOX}
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-white"
              onLoad={handleLoad}
              onError={handleError}
            />
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgb(var(--surface-2))]">
                <Icon name="loader-2" size={22} className="animate-spin text-[rgb(var(--text-3))]" />
                <p className="text-[11px] text-[rgb(var(--text-3))]">Loading…</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))]">
            <Icon name="globe" size={28} />
            <p className="text-[12px]">
              {editing ? 'Enter a URL above and press Enter' : 'Click the URL bar to set a page'}
            </p>
            {!editing && (
              <Button variant="hollow" size="xs" className="nodrag nopan mt-1" onPointerDown={e => e.stopPropagation()} onClick={startEdit}>
                Set URL
              </Button>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
