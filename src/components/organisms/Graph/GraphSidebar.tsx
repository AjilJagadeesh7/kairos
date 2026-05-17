import { ArrowRight, FileText, Network, SquareKanban, Tag, X } from 'lucide-react'
import { stripMarkdown } from '../../../utils/stripMarkdown'
import { useKanbanStore } from '../../../store/useKanbanStore'
import type { GNode, GLink } from '../../../types'
import type { Note } from '../../../types'

type GraphMode = 'links' | 'tags'

interface SelectedTaskInfo {
  nodeId: string
  label: string
  boardName: string
  columnName: string
  boardId: string
}

interface GraphSidebarProps {
  graphMode: GraphMode
  onModeChange: (mode: GraphMode) => void
  nodes: GNode[]
  links: GLink[]
  wikilinkCount: number
  semanticCount: number
  taskNodeCount: number
  tagLegendItems: { shown: string[]; total: number }
  tagColorMap: Map<string, string>
  selectedNote: Note | null
  selectedTaskInfo: SelectedTaskInfo | null
  showTasks: boolean
  onToggleTasks: () => void
  onOpenNote: (noteId: string) => void
  onOpenTask: (nodeId: string) => void
  onClose?: () => void
}

export function GraphSidebar({
  graphMode, onModeChange,
  nodes, links,
  wikilinkCount, semanticCount, taskNodeCount,
  tagLegendItems, tagColorMap,
  selectedNote, selectedTaskInfo,
  showTasks, onToggleTasks,
  onOpenNote, onOpenTask, onClose,
}: GraphSidebarProps): JSX.Element {
  const noteCount = nodes.filter(n => n.nodeType === 'note').length

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
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

      <div className="flex flex-col gap-5 overflow-y-auto p-3">

        {/* Graph type toggle */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text3">Graph Type</p>
          <div className="flex flex-col gap-1">
            {(['links', 'tags'] as GraphMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                style={{
                  background: graphMode === mode ? 'rgb(var(--surface-3))' : 'transparent',
                  color:      graphMode === mode ? 'rgb(var(--text))'      : 'rgb(var(--text-3))',
                }}
              >
                {mode === 'links' ? <Network size={13} /> : <Tag size={13} />}
                {mode === 'links' ? 'Links' : 'Tags'}
              </button>
            ))}
          </div>
        </section>

        {/* Include tasks toggle */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text3">Options</p>
          <label className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-surface3">
            <span className="flex items-center gap-2 text-xs text-text2">
              <SquareKanban size={13} /> Include Tasks
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showTasks}
              onClick={onToggleTasks}
              className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                showTasks ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--surface-3))]'
              }`}
            >
              <span className={`inline-block h-3 w-3 translate-x-0.5 rounded-full bg-white shadow transition-transform ${
                showTasks ? 'translate-x-[17px]' : ''
              }`} />
            </button>
          </label>
        </section>

        {/* Stats */}
        <section>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text3">Stats</p>
          <div className="flex flex-col gap-0.5 text-xs text-text2">
            <span>{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
            {showTasks && <span>{taskNodeCount} task{taskNodeCount !== 1 ? 's' : ''}</span>}
            <span>{links.length} connection{links.length !== 1 ? 's' : ''}</span>
          </div>
        </section>

        {/* Legend */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text3">Legend</p>
          {graphMode === 'links' ? (
            <div className="flex flex-col gap-2 text-[11px] text-text2">
              <LegendLine color="#2dd4bf" dashed label={`Wikilink (${wikilinkCount})`} arrow />
              <LegendLine color="#818cf8" dashed label={`Semantic (${semanticCount})`} />
              {showTasks && <>
                <LegendLine color="#fb923c" label="Task → Note" arrow />
                <LegendLine color="#c084fc" label="Task → Task" />
              </>}
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

        {/* Selected task panel */}
        {selectedTaskInfo && !selectedNote && (
          <section className="rounded-xl border border-border bg-surface3 p-3">
            <div className="mb-1.5 flex items-start gap-1.5">
              <SquareKanban size={12} className="mt-0.5 shrink-0 text-text3" />
              <p className="text-xs font-semibold leading-snug text-text">
                {selectedTaskInfo.label}
              </p>
            </div>
            <p className="mb-1 text-[10px] text-text3">
              {selectedTaskInfo.boardName} · {selectedTaskInfo.columnName}
            </p>
            <button
              onClick={() => onOpenTask(selectedTaskInfo.nodeId)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface2 px-2 py-1.5 text-[10px] font-semibold text-text transition hover:opacity-80"
            >
              Open task <ArrowRight size={10} />
            </button>
          </section>
        )}
      </div>
    </aside>
  )
}

function LegendLine({ color, dashed, label, arrow }: { color: string; dashed?: boolean; label: string; arrow?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="8" viewBox="0 0 22 8" fill="none" className="shrink-0">
        <line x1="0" y1="4" x2={arrow ? "18" : "22"} y2="4"
          stroke={color} strokeWidth={dashed ? "1.5" : "1.5"}
          strokeDasharray={dashed ? "5 3" : undefined} />
        {arrow && <polygon points="18,1.5 22,4 18,6.5" fill={color} />}
      </svg>
      {label}
    </span>
  )
}
