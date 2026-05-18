import { useEffect, useRef, useState } from 'react'
import { History, RotateCcw, X } from 'lucide-react'
import { timeAgo } from '../../../utils/timeAgo'
import { stripMarkdown } from '../../../utils/stripMarkdown'
import type { ContentVersion } from '../../../types'

interface HistoryPanelProps {
  id: string
  type: 'note' | 'journal'
  onRestore: (content: string, title?: string) => void
  onClose: () => void
}

export function HistoryPanel({ id, type, onRestore, onClose }: HistoryPanelProps) {
  const [versions, setVersions]     = useState<ContentVersion[]>([])
  const [selected, setSelected]     = useState<number | null>(null)
  const [loading, setLoading]       = useState(true)
  const listRef                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setSelected(null)
    void (async () => {
      const { readNoteHistory, readJournalHistory } = await import('../../../sync/plainFolder')
      const history = type === 'note'
        ? await readNoteHistory(id)
        : await readJournalHistory(id)
      // Show newest first
      setVersions([...history].reverse())
      setLoading(false)
      if (history.length > 0) setSelected(0)
    })()
  }, [id, type])

  const chosen = selected !== null ? versions[selected] : null

  const handleRestore = () => {
    if (!chosen) return
    onRestore(chosen.content, chosen.title)
  }

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-72 flex-col border-l border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <History size={14} className="text-[rgb(var(--accent))]" />
          <span className="text-sm font-semibold text-[rgb(var(--text))]">Version History</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
          aria-label="Close history"
        >
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[rgb(var(--text-3))]">
          Loading…
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <History size={28} className="text-[rgb(var(--text-3))] opacity-40" />
          <p className="text-sm text-[rgb(var(--text-3))]">No saved versions yet.</p>
          <p className="text-xs text-[rgb(var(--text-3))] opacity-70">Versions are saved automatically each time you write.</p>
        </div>
      ) : (
        <>
          {/* Version list */}
          <div ref={listRef} className="flex-1 overflow-y-auto py-1">
            {versions.map((v, i) => {
              const isSelected = selected === i
              const preview    = stripMarkdown(v.content).slice(0, 80)
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`w-full px-4 py-2.5 text-left transition ${
                    isSelected
                      ? 'bg-[rgb(var(--accent)/0.08)] border-l-2 border-[rgb(var(--accent))]'
                      : 'border-l-2 border-transparent hover:bg-[rgb(var(--surface-2))]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium ${isSelected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-2))]'}`}>
                      {timeAgo(v.savedAt)}
                    </span>
                    {i === 0 && (
                      <span className="rounded-full bg-[rgb(var(--accent)/0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--accent))]">
                        Latest
                      </span>
                    )}
                  </div>
                  {v.title && (
                    <p className="mt-0.5 truncate text-xs font-medium text-[rgb(var(--text))]">{v.title}</p>
                  )}
                  {preview && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[rgb(var(--text-3))]">{preview}</p>
                  )}
                  <p className="mt-1 text-[10px] text-[rgb(var(--text-3))] opacity-60">
                    {new Date(v.savedAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Preview + restore */}
          {chosen && (
            <div className="shrink-0 border-t border-[rgb(var(--border))]">
              <div className="max-h-36 overflow-y-auto px-4 py-3">
                {chosen.title && (
                  <p className="mb-1 text-xs font-semibold text-[rgb(var(--text))]">{chosen.title}</p>
                )}
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[rgb(var(--text-2))]">
                  {stripMarkdown(chosen.content).slice(0, 400) || <em className="text-[rgb(var(--text-3))]">Empty</em>}
                </p>
              </div>
              <div className="border-t border-[rgb(var(--border))] px-4 py-2.5">
                <button
                  onClick={handleRestore}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[rgb(var(--accent)/0.1)] px-3 py-2 text-xs font-semibold text-[rgb(var(--accent))] transition hover:bg-[rgb(var(--accent)/0.18)]"
                >
                  <RotateCcw size={12} />
                  Restore this version
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
