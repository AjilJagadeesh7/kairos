import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useAiStore } from '../../../../store/useAiStore'
import { Button } from '../../../atoms/Button'
import { Select } from '../../../atoms/Select'
import { PlanFooter, PlanRow } from '../BoardBubble/PlanCard'
import { resolveTaskTarget, taskActions } from '../../../../ai/agent/taskPlanActions'
import type { TaskPlan, TaskPlanHandlers } from '../../../../types'

interface Props {
  messageId: string
  plan: TaskPlan
  busy: boolean
  handlers: TaskPlanHandlers
}

/** Action items from the note, proposed as cards on a board picked here. */
export function TaskPlanCard({ messageId, plan, busy, handlers }: Props) {
  const navigate = useNavigate()
  const boards = useKanbanStore((s) => s.boards)
  const isLoaded = useKanbanStore((s) => s.isLoaded)
  const remembered = useAiStore((s) => s.taskTarget)
  const pending = plan.state === 'pending'

  // Boards load lazily (on the first Kanban visit); the picker needs them now.
  useEffect(() => { if (!isLoaded) void useKanbanStore.getState().loadBoards() }, [isLoaded])

  const target = useMemo(() => resolveTaskTarget(
    plan.state === 'pending' ? plan : { ...plan, boardId: plan.appliedBoardId ?? plan.boardId },
    boards, remembered), [plan, boards, remembered])
  const actions = useMemo(() => (target ? taskActions(plan, target, pending) : []), [plan, target, pending])
  const selectedCount = actions.filter((a) => a.resolved && plan.selected.includes(a.id)).length

  if (!target) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-2 py-1.5 text-[12px] text-text3">
        <span>{isLoaded ? 'No boards yet — create one first.' : 'Loading boards…'}</span>
        {isLoaded && <Button variant="hollow" size="xs" onClick={() => navigate('/kanban')}>Open Kanban</Button>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {pending ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text3">
          <span>Add to</span>
          <Select
            value={target.board.id}
            options={boards.map((b) => ({ value: b.id, label: b.title }))}
            onChange={(id) => handlers.setTarget(messageId, id, null)}
          />
          <Select
            value={target.column.id}
            options={[...target.board.columns].sort((a, b) => a.order - b.order).map((c) => ({ value: c.id, label: c.title }))}
            onChange={(id) => handlers.setTarget(messageId, target.board.id, id)}
          />
        </div>
      ) : null}
      <ul className="flex flex-col gap-1">
        {actions.map((a) => (
          <PlanRow
            key={a.id}
            action={a}
            pending={pending}
            checked={!!a.resolved && plan.selected.includes(a.id)}
            onToggle={() => handlers.toggle(messageId, a.id)}
          />
        ))}
      </ul>
      <PlanFooter
        state={plan.state}
        selectedCount={selectedCount}
        busy={busy}
        appliedText={`Created ${plan.createdKeys?.join(', ') || `${plan.appliedCount ?? 0} cards`} on ${target.board.title} › ${target.column.title}, linked to this note.`}
        undoable={!!plan.undoable}
        // apply() resolves the target from the same plan, boards and remembered pick as above.
        onApply={() => handlers.apply(messageId)}
        onCancel={() => handlers.cancel(messageId)}
        onUndo={() => handlers.undo(messageId)}
      />
      {plan.state === 'applied' && (
        <Button variant="link" size="xs" className="self-start" onClick={() => navigate(`/kanban/${target.board.id}`)}>
          Open {target.board.title}
        </Button>
      )}
    </div>
  )
}
