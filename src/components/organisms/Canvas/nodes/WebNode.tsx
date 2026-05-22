import { useState, useCallback, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { invoke } from '@tauri-apps/api/core'
import { Icon } from '../../../../icons/Icon'
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
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => () => clearTimers(), [])

  const commit = useCallback(() => {
    const url = normalizeUrl(draft)
    if (url) {
      setLiveUrl(url)
      setEditing(false)
      setLoading(true)
      setBlocked(false)
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
    <div className={`relative flex h-full min-h-[240px] min-w-[320px] flex-col overflow-hidden rounded-xl border bg-[rgb(var(--surface))] shadow-md transition-shadow ${
      selected ? 'border-[rgb(var(--accent))] shadow-[0_0_0_2px_rgba(var(--accent),0.2)]' : 'border-[rgb(var(--border))]'
    }`}>
      <NodeResizer minWidth={320} minHeight={240} isVisible={selected} lineStyle={{ borderColor: 'rgb(var(--accent))' }} handleStyle={{ borderColor: 'rgb(var(--accent))' }} />

      <Handle type="source" position={Position.Top}    id="t" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left}   id="l" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right}  id="r" style={HANDLE_STYLE} />

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
          <a href={liveUrl} target="_blank" rel="noreferrer"
            onPointerDown={e => e.stopPropagation()}
            className="nodrag nopan flex h-5 w-5 shrink-0 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text))]"
            title="Open in browser">
            <Icon name="external-link" size={11} />
          </a>
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
        {liveUrl && !editing ? (
          <>
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              title={liveUrl}
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
            {blocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[rgb(var(--surface-2))] px-4 text-center">
                <Icon name="shield-check" size={28} className="text-[rgb(var(--text-3))]" />
                <p className="text-[13px] font-medium text-[rgb(var(--text))]">This site blocks embedding</p>
                <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                  This site uses security headers or JavaScript to refuse iframe embedding.
                </p>
                {IS_TAURI && (
                  <button type="button" onPointerDown={e => e.stopPropagation()}
                    onClick={() => invoke('open_app_browser', { url: liveUrl }).catch(() => {})}
                    className="nodrag nopan inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--accent))] px-3 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90">
                    <Icon name="globe" size={12} /> Open in app browser
                  </button>
                )}
                <a href={liveUrl} target="_blank" rel="noreferrer"
                  onPointerDown={e => e.stopPropagation()}
                  className="nodrag nopan inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-[12px] text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]">
                  <Icon name="external-link" size={12} /> Open in system browser
                </a>
                <button type="button" onPointerDown={e => e.stopPropagation()} onClick={startEdit}
                  className="nodrag nopan text-[11px] text-[rgb(var(--text-3))] underline hover:text-[rgb(var(--text))]">
                  Change URL
                </button>
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
              <button type="button" onPointerDown={e => e.stopPropagation()} onClick={startEdit}
                className="nodrag nopan mt-1 rounded-lg border border-[rgb(var(--border))] px-3 py-1 text-[11px] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]">
                Set URL
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
