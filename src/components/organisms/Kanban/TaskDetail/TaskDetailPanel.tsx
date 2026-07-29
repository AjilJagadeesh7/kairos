import { useNavigate } from 'react-router-dom'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { IconButton } from '../../../atoms/IconButton'
import { IssueTypeIcon } from '../../../atoms/IssueTypeIcon'
import { TaskDetailBody } from './TaskDetailBody'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  task: KanbanTask
  board: Board
  onClose: () => void
}

/** Right-hand drawer wrapper around the shared task detail body. */
export function TaskDetailPanel({ task, board, onClose }: Props): JSX.Element {
  const navigate = useNavigate()
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)
  const parent = task.parentId ? board.tasks.find(t => t.id === task.parentId) : null

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[rgb(var(--surface))]">
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-[rgb(var(--border))] px-3 py-2.5">
        <IconButton icon="arrow-left" label="Back" size="md" className="-ml-1 md:hidden" onClick={onClose} />
        <IssueTypeIcon type={task.type} size={15} />
        {parent && (
          <button onClick={() => setActiveTaskId(parent.id)} className="truncate font-mono text-[11px] text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]">
            {parent.key}
          </button>
        )}
        {parent && <Icon name="chevron-right" size={11} className="text-[rgb(var(--text-3))]" />}
        <span className="font-mono text-[11px] text-[rgb(var(--text-2))]">{task.key}</span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton icon="external-link" label="Open full page" size="md" onClick={() => navigate(`/kanban/${board.id}/${task.id}`)} />
          <IconButton icon="x" label="Close" size="md" className="hidden md:flex" onClick={onClose} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <TaskDetailBody task={task} board={board} variant="drawer" onOpen={setActiveTaskId} onDeleted={onClose} />
      </div>
    </div>
  )
}
