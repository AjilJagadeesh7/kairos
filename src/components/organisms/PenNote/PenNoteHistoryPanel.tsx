import { useState } from 'react'
import { usePenNoteHistoryStore } from '../../../store/usePenNoteHistoryStore'
import { timeAgo } from '../../../utils/timeAgo'
import type { PenStroke } from '../../../types'
import { Icon } from '../../../icons/Icon'

interface Props {
  penNoteId: string
  onRestore: (strokes: PenStroke[]) => void
  onClose: () => void
}

/** Version history for a pen note — mirrors the notes HistoryPanel, but lists
 *  ink snapshots and restores strokes. */
export function PenNoteHistoryPanel({ penNoteId, onRestore, onClose }: Props): JSX.Element {
  const versionsAsc = usePenNoteHistoryStore(s => s.byNote[penNoteId]) ?? []
  const versions = [...versionsAsc].reverse() // newest first
  const [selected, setSelected] = useState<number | null>(versions.length ? 0 : null)
  const chosen = selected !== null ? versions[selected] : null

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-72 flex-col border-l border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="history" size={14} className="text-[rgb(var(--accent))]" />
          <span className="text-sm font-semibold text-[rgb(var(--text))]">Version History</span>
        </div>
        <button onClick={onClose} aria-label="Close history"
          className="rounded p-1 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
          <Icon name="x" size={14} />
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Icon name="history" size={28} className="text-[rgb(var(--text-3))] opacity-40" />
          <p className="text-sm text-[rgb(var(--text-3))]">No saved versions yet.</p>
          <p className="text-xs text-[rgb(var(--text-3))] opacity-70">Versions are saved automatically as you write.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto py-1">
            {versions.map((v, i) => {
              const isSelected = selected === i
              return (
                <button key={v.savedAt + i} onClick={() => setSelected(i)}
                  className={`w-full px-4 py-2.5 text-left transition ${isSelected
                    ? 'bg-[rgb(var(--accent)/0.08)] border-l-2 border-[rgb(var(--accent))]'
                    : 'border-l-2 border-transparent hover:bg-[rgb(var(--surface-2))]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium ${isSelected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-2))]'}`}>
                      {timeAgo(v.savedAt)}
                    </span>
                    {i === 0 && (
                      <span className="rounded-full bg-[rgb(var(--accent)/0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--accent))]">Latest</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[rgb(var(--text-3))]">{v.strokeCount} stroke{v.strokeCount === 1 ? '' : 's'}</p>
                  <p className="mt-1 text-[10px] text-[rgb(var(--text-3))] opacity-60">
                    {new Date(v.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              )
            })}
          </div>

          {chosen && (
            <div className="shrink-0 border-t border-[rgb(var(--border))] px-4 py-2.5">
              <button onClick={() => onRestore(chosen.strokes)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[rgb(var(--accent)/0.1)] px-3 py-2 text-xs font-semibold text-[rgb(var(--accent))] transition hover:bg-[rgb(var(--accent)/0.18)]">
                <Icon name="rotate-ccw" size={12} />
                Restore this version
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
