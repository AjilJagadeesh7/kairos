
import { stripMarkdown } from '../../../utils/stripMarkdown'
import type { GNode, GLink, GraphMode, Note } from '../../../types'
import { Icon } from '../../../icons/Icon'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { ToggleSwitch } from '../../atoms/ToggleSwitch'
import { SectionLabel } from '../../atoms/SectionLabel'


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
  canvasNodeCount: number
  tagLegendItems: { shown: string[]; total: number }
  tagColorMap: Map<string, string>
  selectedNote: Note | null
  selectedTaskInfo: SelectedTaskInfo | null
  selectedCanvasInfo: { canvasId: string; title: string } | null
  showTasks: boolean
  showCanvas: boolean
  onToggleTasks: () => void
  onToggleCanvas: () => void
  onOpenNote: (noteId: string) => void
  onOpenTask: (nodeId: string) => void
  onOpenCanvas: (canvasId: string) => void
  onClose?: () => void
}

export function GraphSidebar({
  graphMode, onModeChange,
  nodes, links,
  wikilinkCount, semanticCount, taskNodeCount, canvasNodeCount,
  tagLegendItems, tagColorMap,
  selectedNote, selectedTaskInfo, selectedCanvasInfo,
  showTasks, showCanvas,
  onToggleTasks, onToggleCanvas,
  onOpenNote, onOpenTask, onOpenCanvas, onClose,
}: GraphSidebarProps): JSX.Element {
  const noteCount = nodes.filter(n => n.nodeType === 'note').length

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <SectionLabel className="flex-1">Graph</SectionLabel>
        {onClose && (
          <IconButton icon="x" label="Close sidebar" size="md" onClick={onClose} className="xl:hidden" />
        )}
      </div>

      <div className="flex flex-col gap-5 overflow-y-auto p-3">

        {/* Graph type toggle */}
        <section>
          <SectionLabel className="mb-2">Graph Type</SectionLabel>
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
                {mode === 'links' ? <Icon name="network" size={13} /> : <Icon name="tag" size={13} />}
                {mode === 'links' ? 'Links' : 'Tags'}
              </button>
            ))}
          </div>
        </section>

        {/* Node type filters */}
        <section>
          <SectionLabel className="mb-2">Node Types</SectionLabel>
          <div className="flex flex-col gap-0.5">
            <FilterRow icon="file-text"    label="Notes"   count={noteCount}        on={true}       onToggle={undefined} dot="#818cf8" />
            <FilterRow icon="square-kanban" label="Tasks"  count={taskNodeCount}    on={showTasks}  onToggle={onToggleTasks} dot="#fb923c" />
            <FilterRow icon="pen-tool"      label="Canvas" count={canvasNodeCount}  on={showCanvas} onToggle={onToggleCanvas} dot="#f59e0b" />
          </div>
        </section>

        {/* Stats */}
        <section>
          <SectionLabel className="mb-1.5">Stats</SectionLabel>
          <div className="flex flex-col gap-0.5 text-xs text-text2">
            <span>{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
            {showTasks  && <span>{taskNodeCount}   task{taskNodeCount   !== 1 ? 's' : ''}</span>}
            {showCanvas && <span>{canvasNodeCount} canvas{canvasNodeCount !== 1 ? 'es' : ''}</span>}
            <span>{links.length} connection{links.length !== 1 ? 's' : ''}</span>
          </div>
        </section>

        {/* Legend */}
        <section>
          <SectionLabel className="mb-2">Legend</SectionLabel>
          {graphMode === 'links' ? (
            <div className="flex flex-col gap-2 text-[11px] text-text2">
              <LegendLine color="#2dd4bf" dashed label={`Wikilink (${wikilinkCount})`} arrow />
              <LegendLine color="#818cf8" dashed label={`Semantic (${semanticCount})`} />
              {showTasks && <>
                <LegendLine color="#fb923c" label="Task → Note" arrow />
                <LegendLine color="#c084fc" label="Task → Task" />
              </>}
              {showCanvas && <>
                <LegendLine color="#f59e0b" label="Canvas → Note" />
                <LegendLine color="#22c55e" label="Note ↔ Note (canvas)" />
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
              <Icon name="file-text" size={12} className="mt-0.5 shrink-0 text-text3" />
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
            <Button variant="ghost" size="sm" fullWidth onClick={() => onOpenNote(selectedNote.id)}>
              Open note <Icon name="arrow-right" size={10} />
            </Button>
          </section>
        )}

        {/* Selected task panel */}
        {selectedTaskInfo && !selectedNote && (
          <section className="rounded-xl border border-border bg-surface3 p-3">
            <div className="mb-1.5 flex items-start gap-1.5">
              <Icon name="square-kanban" size={12} className="mt-0.5 shrink-0 text-text3" />
              <p className="text-xs font-semibold leading-snug text-text">
                {selectedTaskInfo.label}
              </p>
            </div>
            <p className="mb-1 text-[10px] text-text3">
              {selectedTaskInfo.boardName} · {selectedTaskInfo.columnName}
            </p>
            <Button variant="ghost" size="sm" fullWidth onClick={() => onOpenTask(selectedTaskInfo.nodeId)}>
              Open task <Icon name="arrow-right" size={10} />
            </Button>
          </section>
        )}

        {/* Selected canvas panel */}
        {selectedCanvasInfo && !selectedNote && !selectedTaskInfo && (
          <section className="rounded-xl border border-border bg-surface3 p-3">
            <div className="mb-2 flex items-start gap-1.5">
              <Icon name="pen-tool" size={12} className="mt-0.5 shrink-0 text-text3" />
              <p className="text-xs font-semibold leading-snug text-text">
                {selectedCanvasInfo.title || 'Untitled Canvas'}
              </p>
            </div>
            <Button variant="ghost" size="sm" fullWidth onClick={() => onOpenCanvas(selectedCanvasInfo.canvasId)}>
              Open canvas <Icon name="arrow-right" size={10} />
            </Button>
          </section>
        )}
      </div>
    </aside>
  )
}

function FilterRow({ icon, label, count, on, onToggle, dot }: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  count: number
  on: boolean
  onToggle: (() => void) | undefined
  dot: string
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${onToggle ? 'cursor-pointer hover:bg-surface3' : ''} transition`}
      onClick={onToggle}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot, opacity: on ? 1 : 0.3 }} />
      <Icon name={icon} size={12} className={on ? 'text-text2' : 'text-text3'} />
      <span className={`flex-1 text-xs ${on ? 'text-text2' : 'text-text3'}`}>{label}</span>
      <span className="text-[10px] text-text3">{count}</span>
      {onToggle && (
        <ToggleSwitch checked={on} onChange={() => onToggle()} label={label} />
      )}
    </div>
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
