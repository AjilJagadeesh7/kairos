import { useNavigate } from 'react-router-dom'
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useConfirmStore } from '../../../../store/useConfirmStore'
import { timeAgo } from '../../../../utils/timeAgo'
import { Button } from '../../../atoms/Button'
import { Dropdown } from '../../../molecules/Dropdown'
import type { Board } from '../../../../types/kanban.types'

interface BoardCardProps {
  board: Board
}

export function BoardCard({ board }: BoardCardProps): JSX.Element {
  const navigate = useNavigate()
  const deleteBoard = useKanbanStore(s => s.deleteBoard)
  const duplicateBoard = useKanbanStore(s => s.duplicateBoard)

  const overdueCount = board.tasks.filter(t => {
    if (!t.due || t.completedAt) return false
    return new Date(t.due) < new Date()
  }).length

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    void useConfirmStore.getState().confirm({
      title: `Delete "${board.title}"?`,
      message: 'This will permanently delete the board and all its tasks.',
      confirmLabel: 'Delete',
      danger: true,
    }).then(confirmed => {
      if (confirmed) deleteBoard(board.id)
    })
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation()
    duplicateBoard(board.id)
  }

  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition hover:border-[rgb(var(--accent))] hover:shadow-sm"
      onClick={() => navigate(`/kanban/${board.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/kanban/${board.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 font-semibold text-[rgb(var(--text))]">{board.title}</h3>
        <div className="opacity-0 transition group-hover:opacity-100" onClick={e => e.stopPropagation()}>
          <Dropdown
            trigger={
              <Button variant="ghost" size="xs" className="h-7 w-7 p-0">
                <MoreHorizontal size={14} />
              </Button>
            }
          >
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
              onClick={handleDuplicate}
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={handleDelete}
            >
              <Trash2 size={13} /> Delete
            </button>
          </Dropdown>
        </div>
      </div>

      {board.description && (
        <p className="line-clamp-2 text-xs text-[rgb(var(--text-2))]">{board.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-[rgb(var(--text-3))]">
        <span>{board.tasks.length} task{board.tasks.length !== 1 ? 's' : ''}</span>
        {overdueCount > 0 && (
          <span className="font-medium text-red-500">{overdueCount} overdue</span>
        )}
        <span className="ml-auto">{timeAgo(board.updatedAt)}</span>
      </div>
    </div>
  )
}
