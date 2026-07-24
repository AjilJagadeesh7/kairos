import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, pointerWithin, useDroppable, type DragEndEvent, type DragStartEvent, type DropAnimation } from '@dnd-kit/core'
import { useDndSensors } from '../../../../hooks/useDndSensors'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { SwimlaneCard } from './SwimlaneCard'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { filterAndSortTasks } from '../../../../utils/kanban'
import type { Board, KanbanColumn, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props { board: Board }

interface Group { id: string; label: string; parent: KanbanTask | null; items: KanbanTask[] }

const DROP_ANIM: DropAnimation = { duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }

function DroppableCell({ id, empty, children }: { id: string; empty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[80px] flex-col gap-2 rounded-lg border-2 p-2 transition-colors ${
        isOver
          ? 'border-dashed border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5'
          : empty
            ? 'border-dashed border-[rgb(var(--border))]'
            : 'border-transparent bg-[rgb(var(--surface-2))]'
      }`}
    >
      {children}
      {empty && (
        <span className={`m-auto text-xs ${isOver ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'}`}>Drop here</span>
      )}
    </div>
  )
}

/** Board grouped into swimlanes by parent story (Jira "Group by Subtask"). */
export function BoardSwimlanes({ board }: Props): JSX.Element {
  const filters = useKanbanStore(s => s.filters)
  const updateTask = useKanbanStore(s => s.updateTask)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragTask, setDragTask] = useState<KanbanTask | null>(null)
  const [dragWidth, setDragWidth] = useState<number>(288)
  const sensors = useDndSensors()

  const columns = useMemo(() => [...board.columns].sort((a, b) => a.order - b.order), [board.columns])

  const groups = useMemo<Group[]>(() => {
    const inSprint = (t: KanbanTask) =>
      !filters.sprint ? true : filters.sprint === '__backlog__' ? !t.sprintId : t.sprintId === filters.sprint
    // Sprint scope gates which parent stories appear; their children ride along.
    const parents = board.tasks.filter(t => !t.parentId && inSprint(t))
    const childrenOf = (id: string) => board.tasks.filter(t => t.parentId === id)
    const withChildren = parents.filter(p => childrenOf(p.id).length > 0)
    const standalone = parents.filter(p => childrenOf(p.id).length === 0)
    const out: Group[] = withChildren
      .sort((a, b) => a.order - b.order)
      .map(p => ({ id: p.id, label: p.title, parent: p, items: childrenOf(p.id) }))
    if (standalone.length > 0) out.push({ id: '__else__', label: 'Everything else', parent: null, items: standalone })
    return out
  }, [board.tasks, filters.sprint])

  // Children ride with their (already sprint-matched) parent, so drop the sprint filter here.
  const cellItems = (items: KanbanTask[], colId: string) =>
    filterAndSortTasks(items.filter(t => t.columnId === colId), { ...filters, sprint: null, sort: 'manual' })

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragTask(null)
    if (!over) return
    const overId = String(over.id)
    if (!overId.startsWith('cell::')) return
    // id shape: cell::<groupId>::<colId>
    const [, groupId, colId] = overId.split('::')
    const task = board.tasks.find(t => t.id === active.id)
    if (!task) return
    // A card only moves within its own swimlane — dragging across parents would
    // re-parent the issue, which isn't a board-drag operation.
    const taskGroup = task.parentId ?? '__else__'
    if (taskGroup !== groupId) return
    if (task.columnId !== colId) updateTask(board.id, String(active.id), { columnId: colId })
  }
  function handleDragStart({ active }: DragStartEvent) {
    setDragTask(board.tasks.find(t => t.id === active.id) ?? null)
    const w = active.rect.current.initial?.width
    if (w) setDragWidth(w)
  }

  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))` }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full overflow-auto p-4">
        <div className="min-w-[720px] space-y-4">
          {groups.map(group => {
            const isCollapsed = collapsed.has(group.id)
            const total = group.items.length
            const parentCol = group.parent ? board.columns.find(c => c.id === group.parent!.columnId) : null
            return (
              <section key={group.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]/40">
                <button
                  onClick={() => setCollapsed(s => { const n = new Set(s); if (n.has(group.id)) n.delete(group.id); else n.add(group.id); return n })}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={14} className="text-[rgb(var(--text-3))]" />
                  {group.parent
                    ? <IssueTypeIcon type={group.parent.type} size={15} />
                    : <Icon name="layers" size={14} className="text-[rgb(var(--text-3))]" />}
                  {group.parent && <span className="font-mono text-[11px] text-[rgb(var(--text-3))]">{group.parent.key}</span>}
                  <span className="truncate text-sm font-semibold text-[rgb(var(--text))]">{group.label}</span>
                  {parentCol && (
                    <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]" style={{ backgroundColor: `${parentCol.color}22` }}>
                      {parentCol.title}
                    </span>
                  )}
                  <span className="ml-1 text-xs text-[rgb(var(--text-3))]">{total}</span>
                </button>

                {!isCollapsed && (
                  <div className="grid gap-3 px-3 pb-3" style={grid}>
                    {columns.map((col: KanbanColumn) => {
                      const items = cellItems(group.items, col.id)
                      return (
                        <div key={col.id} className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-[rgb(var(--text-2))]">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
                            {col.title}
                            <span className="text-[rgb(var(--text-3))]">{items.length}</span>
                          </div>
                          <DroppableCell id={`cell::${group.id}::${col.id}`} empty={items.length === 0}>
                            {items.map(t => <SwimlaneCard key={t.id} task={t} board={board} />)}
                          </DroppableCell>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
          {groups.length === 0 && (
            <p className="py-12 text-center text-sm text-[rgb(var(--text-3))]">No issues yet. Create some on the flat board.</p>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={DROP_ANIM}>
        {dragTask && <div style={{ width: dragWidth }}><SwimlaneCard task={dragTask} board={board} overlay /></div>}
      </DragOverlay>
    </DndContext>
  )
}
