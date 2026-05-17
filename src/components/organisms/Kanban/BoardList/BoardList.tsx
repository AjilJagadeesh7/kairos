import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../../atoms/Button'
import { BoardCard } from './BoardCard'
import { NewBoardModal } from './NewBoardModal'
import type { Board } from '../../../../types/kanban.types'

interface BoardListProps {
  boards: Board[]
}

export function BoardList({ boards }: BoardListProps): JSX.Element {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--text))]">Boards</h1>
            <p className="mt-0.5 text-sm text-[rgb(var(--text-2))]">
              {boards.length === 0 ? 'No boards yet' : `${boards.length} board${boards.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5" onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Board
          </Button>
        </div>

        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[rgb(var(--border))] p-16 text-center">
            <p className="mb-4 text-[rgb(var(--text-2))]">No boards yet. Create your first board to get started.</p>
            <Button variant="primary" size="sm" className="inline-flex items-center gap-1.5" onClick={() => setShowModal(true)}>
              <Plus size={14} /> Create Board
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map(board => (
              <BoardCard key={board.id} board={board} />
            ))}
            <button
              className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--border))] text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
              onClick={() => setShowModal(true)}
            >
              <Plus size={20} />
              <span className="text-sm font-medium">New Board</span>
            </button>
          </div>
        )}
      </div>

      {showModal && <NewBoardModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
