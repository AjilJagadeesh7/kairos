import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, FileText, Unlink } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { stripMarkdown } from '../../../utils/stripMarkdown'

interface TransclusionEmbedProps {
  title: string
}

export function TransclusionEmbed({ title }: TransclusionEmbedProps) {
  const [collapsed, setCollapsed] = useState(false)
  const notes       = useAppStore(s => s.notes)
  const isLoaded    = useAppStore(s => s.isNotesLoaded)

  const note = isLoaded
    ? notes.find(n => n.title.trim().toLowerCase() === title.trim().toLowerCase())
    : undefined

  // useNavigate won't work outside the Router tree when rendered via createRoot.
  // We use window history directly as a fallback.
  const navigateToNote = useCallback(() => {
    if (!note) return
    // Dispatch a custom event that MarkdownEditor can listen to for navigation.
    window.dispatchEvent(new CustomEvent('mv:navigate', { detail: { path: `/notes/${note.id}` } }))
  }, [note])

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsed(c => !c)
  }

  const preview = note?.content ? stripMarkdown(note.content) : null

  return (
    <div
      className="transclusion-embed rounded-lg border border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent)/0.04)] overflow-hidden"
      contentEditable={false}
      data-transclusion={title}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-[rgb(var(--accent)/0.06)] transition-colors"
        onClick={toggle}
      >
        <span className="shrink-0 text-[rgb(var(--accent))]">
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </span>

        <FileText size={13} className="shrink-0 text-[rgb(var(--accent))] opacity-70" />

        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--accent))]">
          {title}
        </span>

        {note && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigateToNote() }}
            title="Open note"
            className="shrink-0 rounded p-0.5 text-[rgb(var(--accent)/0.6)] hover:text-[rgb(var(--accent))] transition-colors"
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-[rgb(var(--accent)/0.12)] px-3 py-2.5">
          {note === undefined && (
            <p className="text-xs text-[rgb(var(--text-3))]">Loading…</p>
          )}

          {note === null && (
            <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-3))] italic">
              <Unlink size={11} />
              <span>Note not found: <strong className="font-medium">{title}</strong></span>
            </div>
          )}

          {note && (
            <>
              {note.tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {note.tags.map(t => (
                    <span
                      key={t}
                      className="rounded-full bg-[rgb(var(--surface-2))] px-2 py-0.5 text-[10px] text-[rgb(var(--text-3))]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {preview ? (
                <p className="text-sm leading-relaxed text-[rgb(var(--text-2))] line-clamp-6">
                  {preview}
                </p>
              ) : (
                <p className="text-xs italic text-[rgb(var(--text-3))]">Empty note</p>
              )}

              <button
                type="button"
                onClick={navigateToNote}
                className="mt-2.5 flex items-center gap-1 text-xs font-medium text-[rgb(var(--accent))] hover:underline"
              >
                Open full note <ExternalLink size={10} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
