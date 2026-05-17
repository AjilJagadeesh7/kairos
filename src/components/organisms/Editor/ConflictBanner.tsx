import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, GitMerge, X } from 'lucide-react'
import { useConflictStore } from '../../../store/useConflictStore'
import { useAppStore } from '../../../store/useAppStore'
import type { Conflict } from '../../../store/useConflictStore'

interface ConflictBannerProps {
  conflict: Conflict
  onApplyRemote: (content: string, title: string) => void
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function ConflictBanner({ conflict, onApplyRemote }: ConflictBannerProps) {
  const [expanded, setExpanded]     = useState(false)
  const [resolving, setResolving]   = useState(false)
  const resolveConflict             = useConflictStore(s => s.resolveConflict)
  const updateActiveNote            = useAppStore(s => s.updateActiveNote)

  async function keepLocal() {
    setResolving(true)
    resolveConflict(conflict.noteId)
  }

  async function keepRemote() {
    setResolving(true)
    const r = conflict.remoteNote
    // Embed + hash the remote content so it saves cleanly
    const { embedText } = await import('../../../utils/embeddingClient')
    const embedded      = await embedText(r.id, `${r.title}\n\n${r.content}`)
    const buf           = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${r.title}\n\n${r.content}`))
    const contentHash   = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    await updateActiveNote({ title: r.title, content: r.content, embedding: embedded.embedding, contentHash })
    onApplyRemote(r.content, r.title)
    resolveConflict(conflict.noteId)
  }

  async function keepBoth() {
    setResolving(true)
    const { localNote: l, remoteNote: r } = conflict
    const merged = `${l.content}\n\n---\n\n> **Remote version** (${fmt(r.updatedAt)})\n\n${r.content}`
    const title  = l.title
    const { embedText } = await import('../../../utils/embeddingClient')
    const embedded      = await embedText(l.id, `${title}\n\n${merged}`)
    const buf           = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${title}\n\n${merged}`))
    const contentHash   = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    await updateActiveNote({ title, content: merged, embedding: embedded.embedding, contentHash })
    onApplyRemote(merged, title)
    resolveConflict(conflict.noteId)
  }

  const { localNote: l, remoteNote: r } = conflict

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-4 mb-2 overflow-hidden rounded-xl border border-amber-400/30 bg-amber-50/80 dark:bg-amber-950/30"
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Sync conflict detected
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
            This note was edited on another device. Choose how to resolve.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
          className="shrink-0 rounded p-1 text-amber-600 transition hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded diff preview */}
      {expanded && (
        <div className="grid grid-cols-2 gap-px border-t border-amber-200/50 dark:border-amber-800/50 bg-amber-200/30 dark:bg-amber-800/20">
          <div className="bg-amber-50/90 dark:bg-amber-950/40 p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Local · {fmt(l.updatedAt)}
            </p>
            <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-200/70">
              {l.content.slice(0, 400)}{l.content.length > 400 ? '…' : ''}
            </pre>
          </div>
          <div className="bg-amber-50/90 dark:bg-amber-950/40 p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Remote · {fmt(r.updatedAt)}
            </p>
            <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-200/70">
              {r.content.slice(0, 400)}{r.content.length > 400 ? '…' : ''}
            </pre>
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2 border-t border-amber-200/50 dark:border-amber-800/50 px-3 py-2">
        <button
          type="button"
          disabled={resolving}
          onClick={() => void keepLocal()}
          className="rounded-lg border border-amber-300/60 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-amber-800 transition hover:bg-white disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/60"
        >
          Keep local
        </button>
        <button
          type="button"
          disabled={resolving}
          onClick={() => void keepRemote()}
          className="rounded-lg border border-amber-300/60 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-amber-800 transition hover:bg-white disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/60"
        >
          Use remote
        </button>
        <button
          type="button"
          disabled={resolving}
          onClick={() => void keepBoth()}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-100/80 px-3 py-1.5 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-200/80 disabled:opacity-50 dark:border-amber-600/40 dark:bg-amber-800/40 dark:text-amber-200 dark:hover:bg-amber-700/60"
        >
          <GitMerge size={12} aria-hidden /> Merge both
        </button>
        <button
          type="button"
          onClick={() => resolveConflict(conflict.noteId)}
          aria-label="Dismiss conflict"
          className="ml-auto rounded p-1.5 text-amber-600/70 transition hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
    </div>
  )
}
