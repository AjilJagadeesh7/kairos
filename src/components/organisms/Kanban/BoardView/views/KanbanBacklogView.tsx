import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, pointerWithin, useDroppable, type DragEndEvent, type DragStartEvent, type DropAnimation } from '@dnd-kit/core'
import { useDndSensors } from '../../../../../hooks/useDndSensors'
import { useKanbanStore } from '../../../../../store/useKanbanStore'
import { BacklogRow } from './BacklogRow'
import { Button } from '../../../../atoms/Button'
import { filterAndSortTasks } from '../../../../../utils/kanban'
import type { Board, KanbanTask, Sprint, SprintStatus } from '../../../../../types/kanban.types'
import { Icon } from '../../../../../icons/Icon'

interface Props { board: Board }

const DROP_ANIM: DropAnimation = { duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }

const STATUS_STYLE: Record<SprintStatus, string> = {
  planned:   'bg-[rgb(var(--surface-3))] text-[rgb(var(--text-2))]',
  active:    'bg-green-500/15 text-green-500',
  completed: 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]',
}

function DropZone({ id, children, className = '' }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-[rgb(var(--accent))]/50' : ''}`}>
      {children}
    </div>
  )
}

/** Jira-style backlog: sprint groups + a backlog pool, with drag-to-assign. */
export function KanbanBacklogView({ board }: Props): JSX.Element {
  const filters = useKanbanStore(s => s.filters)
  const createSprint = useKanbanStore(s => s.createSprint)
  const updateSprint = useKanbanStore(s => s.updateSprint)
  const deleteSprint = useKanbanStore(s => s.deleteSprint)
  const moveTaskToSprint = useKanbanStore(s => s.moveTaskToSprint)
  const [dragTask, setDragTask] = useState<KanbanTask | null>(null)
  const sensors = useDndSensors()

  const sprints = useMemo(() => [...(board.sprints ?? [])].sort((a, b) => a.order - b.order), [board.sprints])

  // Only top-level issues appear in the backlog; subtasks travel with their parent.
  const tops = useMemo(
    () => filterAndSortTasks(board.tasks.filter(t => !t.parentId), { ...filters, sort: 'manual' }),
    [board.tasks, filters],
  )
  const bySprint = (sprintId: string | null) => tops.filter(t => (t.sprintId ?? null) === sprintId)

  function handleDragStart({ active }: DragStartEvent) {
    setDragTask(board.tasks.find(t => t.id === active.id) ?? null)
  }
  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragTask(null)
    if (!over) return
    const overId = String(over.id)
    const sprintId = overId === 'backlog' ? null : overId.startsWith('sprint-') ? overId.slice(7) : undefined
    if (sprintId === undefined) return
    moveTaskToSprint(board.id, String(active.id), sprintId)
  }

  function cycleStatus(s: Sprint) {
    const next: SprintStatus = s.status === 'planned' ? 'active' : s.status === 'active' ? 'completed' : 'planned'
    updateSprint(board.id, s.id, { status: next })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full overflow-auto p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Backlog & Sprints</h2>
            <Button variant="hollow" size="sm" onClick={() => createSprint(board.id, `Sprint ${sprints.length + 1}`)}>
              <Icon name="plus" size={13} /> Create sprint
            </Button>
          </div>

          {sprints.map(sprint => {
            const items = bySprint(sprint.id)
            return (
              <DropZone key={sprint.id} id={`sprint-${sprint.id}`} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/40 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Icon name="layers" size={14} className="text-[rgb(var(--text-3))]" />
                  <span className="text-sm font-semibold text-[rgb(var(--text))]">{sprint.name}</span>
                  <button onClick={() => cycleStatus(sprint)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLE[sprint.status]}`} title="Click to change status">
                    {sprint.status}
                  </button>
                  <span className="text-xs text-[rgb(var(--text-3))]">{items.length} issue{items.length !== 1 ? 's' : ''}</span>
                  <button onClick={() => deleteSprint(board.id, sprint.id)} className="ml-auto rounded p-1 text-[rgb(var(--text-3))] hover:text-red-500" title="Delete sprint (issues return to backlog)">
                    <Icon name="trash-2" size={13} />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {items.length === 0
                    ? <p className="rounded-md border border-dashed border-[rgb(var(--border))] px-3 py-3 text-center text-xs text-[rgb(var(--text-3))]">Drag issues here to plan this sprint</p>
                    : items.map(t => <BacklogRow key={t.id} task={t} board={board} />)}
                </div>
              </DropZone>
            )
          })}

          <DropZone id="backlog" className="rounded-xl border border-[rgb(var(--border))] p-3">
            <div className="mb-2 flex items-center gap-2">
              <Icon name="list" size={14} className="text-[rgb(var(--text-3))]" />
              <span className="text-sm font-semibold text-[rgb(var(--text))]">Backlog</span>
              <span className="text-xs text-[rgb(var(--text-3))]">{bySprint(null).length} issue{bySprint(null).length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1.5">
              {bySprint(null).length === 0
                ? <p className="px-3 py-3 text-center text-xs text-[rgb(var(--text-3))]">No unplanned issues.</p>
                : bySprint(null).map(t => <BacklogRow key={t.id} task={t} board={board} />)}
            </div>
          </DropZone>
        </div>
      </div>

      <DragOverlay dropAnimation={DROP_ANIM}>
        {dragTask && <div className="w-80"><BacklogRow task={dragTask} board={board} overlay /></div>}
      </DragOverlay>
    </DndContext>
  )
}
