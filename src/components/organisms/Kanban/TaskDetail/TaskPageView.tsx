import { useNavigate } from 'react-router-dom'
import { TaskDetailBody } from './TaskDetailBody'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { ISSUE_TYPE_META } from '../../../../utils/kanban'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  board: Board
  task: KanbanTask
}

/** Full-page view of a single issue (deep-linkable at /kanban/:boardId/:taskId). */
export function TaskPageView({ board, task }: Props): JSX.Element {
  const navigate = useNavigate()
  const parent = task.parentId ? board.tasks.find(t => t.id === task.parentId) : null

  function openTask(id: string) {
    navigate(`/kanban/${board.id}/${id}`)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[rgb(var(--bg))]">
      {/* Breadcrumb header */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-xs text-[rgb(var(--text-3))]">
        <button onClick={() => navigate('/kanban')} className="rounded px-1 py-0.5 hover:text-[rgb(var(--text))]">Boards</button>
        <Icon name="chevron-right" size={11} />
        <button onClick={() => navigate(`/kanban/${board.id}`)} className="max-w-[160px] truncate rounded px-1 py-0.5 hover:text-[rgb(var(--text))]">{board.title}</button>
        {parent && (
          <>
            <Icon name="chevron-right" size={11} />
            <button onClick={() => openTask(parent.id)} className="rounded px-1 py-0.5 font-mono text-[11px] hover:text-[rgb(var(--text))]">{parent.key}</button>
          </>
        )}
        <Icon name="chevron-right" size={11} />
        <span className="flex items-center gap-1 font-mono text-[11px] text-[rgb(var(--text-2))]">
          <IssueTypeIcon type={task.type} size={13} /> {task.key}
        </span>
        <span className="ml-auto rounded-full bg-[rgb(var(--surface-2))] px-2 py-0.5 text-[10px] font-medium capitalize text-[rgb(var(--text-2))]">
          {ISSUE_TYPE_META[task.type].label}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <TaskDetailBody task={task} board={board} variant="page" onOpen={openTask} onDeleted={() => navigate(`/kanban/${board.id}`)} />
        </div>
      </div>
    </div>
  )
}
