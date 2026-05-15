import { ArrowRight, FileText, Network, Tag, X } from 'lucide-react'
import { stripMarkdown } from '../../../utils/stripMarkdown'
import type { GNode, GLink } from '../../../types'
import type { Note } from '../../../types'

type GraphMode = 'links' | 'tags'

interface GraphSidebarProps {
  graphMode: GraphMode
  onModeChange: (mode: GraphMode) => void
  nodes: GNode[]
  links: GLink[]
  wikilinkCount: number
  semanticCount: number
  tagLegendItems: { shown: string[]; total: number }
  tagColorMap: Map<string, string>
  selectedNote: Note | null
  onOpenNote: (noteId: string) => void
  onClose?: () => void
}

export function GraphSidebar({
  graphMode, onModeChange,
  nodes, links,
  wikilinkCount, semanticCount,
  tagLegendItems, tagColorMap,
  selectedNote, onOpenNote, onClose,
}: GraphSidebarProps): JSX.Element {
  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      {/* Header — mirrors Sidebar.tsx header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-text3">Graph</span>
        {onClose && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text2 transition hover:bg-surface3 hover:text-text xl:hidden"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex flex-col gap-5 overflow-y-auto p-3">

        {/* Graph type toggle */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text3">Graph Type</p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onModeChange('links')}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
              style={{
                background: graphMode === 'links' ? 'rgb(var(--surface-3))' : 'transparent',
                color:      graphMode === 'links' ? 'rgb(var(--text))'      : 'rgb(var(--text-3))',
              }}
            >
              <Network size={13} /> Links
            </button>
            <button
              onClick={() => onModeChange('tags')}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
              style={{
                background: graphMode === 'tags' ? 'rgb(var(--surface-3))' : 'transparent',
                color:      graphMode === 'tags' ? 'rgb(var(--text))'      : 'rgb(var(--text-3))',
              }}
            >
              <Tag size={13} /> Tags
            </button>
          </div>
        </section>

        {/* Stats */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text3">Stats</p>
          <div className="flex flex-col gap-0.5 text-xs text-text2">
            <span>{nodes.length} notes</span>
            <span>{links.length} connections</span>
          </div>
        </section>

        {/* Legend */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text3">Legend</p>
          {graphMode === 'links' ? (
            <div className="flex flex-col gap-2 text-[11px] text-text2">
              <span className="flex items-center gap-2">
                <svg width="22" height="8" viewBox="0 0 22 8" fill="none" className="shrink-0">
                  <line x1="0" y1="4" x2="22" y2="4" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="5 3" />
                  <polygon points="18,1.5 22,4 18,6.5" fill="#2dd4bf" />
                </svg>
                Wikilink ({wikilinkCount})
              </span>
              <span className="flex items-center gap-2">
                <svg width="22" height="8" viewBox="0 0 22 8" fill="none" className="shrink-0">
                  <line x1="0" y1="4" x2="22" y2="4" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="2 2" />
                </svg>
                Semantic ({semanticCount})
              </span>
            </div>
          ) : tagLegendItems.total > 0 ? (
            <div className="flex flex-col gap-1.5">
              {tagLegendItems.shown.map(tag => (
                <span key={tag} className="flex items-center gap-2 text-[11px] text-text2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: tagColorMap.get(tag) ?? '#888888' }} />
                  #{tag}
                </span>
              ))}
              {tagLegendItems.total > tagLegendItems.shown.length && (
                <span className="text-[10px] text-text3">
                  +{tagLegendItems.total - tagLegendItems.shown.length} more tags
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-text3">No shared tags found</span>
          )}
        </section>

        {/* Selected note panel */}
        {selectedNote && (
          <section className="rounded-xl border border-border bg-surface3 p-3">
            <div className="mb-1.5 flex items-start gap-1.5">
              <FileText size={12} className="mt-0.5 shrink-0 text-text3" />
              <p className="text-xs font-semibold leading-snug text-text">
                {selectedNote.title || 'Untitled'}
              </p>
            </div>
            {selectedNote.tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {selectedNote.tags.slice(0, 6).map(t => {
                  const tc = tagColorMap.get(t)
                  return (
                    <span key={t}
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{
                        background: tc ? `${tc}28` : 'rgb(var(--surface-2))',
                        color:      tc ?? 'rgb(var(--text-3))',
                        border:     `1px solid ${tc ? `${tc}55` : 'rgb(var(--border))'}`,
                      }}>
                      #{t}
                    </span>
                  )
                })}
              </div>
            )}
            {selectedNote.content && (
              <p className="mb-2.5 line-clamp-4 text-[10px] leading-relaxed text-text2">
                {stripMarkdown(selectedNote.content).slice(0, 160)}
              </p>
            )}
            <button
              onClick={() => onOpenNote(selectedNote.id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface2 px-2 py-1.5 text-[10px] font-semibold text-text transition hover:opacity-80"
            >
              Open note <ArrowRight size={10} />
            </button>
          </section>
        )}
      </div>
    </aside>
  )
}
