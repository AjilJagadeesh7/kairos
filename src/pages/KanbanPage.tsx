import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useKanbanStore } from '../store/useKanbanStore'
import { BoardList } from '../components/organisms/Kanban/BoardList/BoardList'
import { BoardView } from '../components/organisms/Kanban/BoardView/BoardView'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { VaultBanner } from '../components/common/VaultBanner'

export function KanbanPage(): JSX.Element {
  const { boardId } = useParams<{ boardId?: string }>()
  const navigate = useNavigate()
  const boards = useKanbanStore(s => s.boards)
  const isLoaded = useKanbanStore(s => s.isLoaded)
  const loadBoards = useKanbanStore(s => s.loadBoards)
  const setActiveBoardId = useKanbanStore(s => s.setActiveBoardId)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)

  useEffect(() => {
    if (!isLoaded) loadBoards()
  }, [isLoaded, loadBoards])

  useEffect(() => {
    setActiveBoardId(boardId ?? null)
    // Clear task selection when switching boards
    setActiveTaskId(null)
  }, [boardId, setActiveBoardId, setActiveTaskId])

  // If boardId in URL but board not found after loading, redirect to list
  useEffect(() => {
    if (isLoaded && boardId && !boards.find(b => b.id === boardId)) {
      navigate('/kanban', { replace: true })
    }
  }, [isLoaded, boardId, boards, navigate])

  if (!isLoaded) {
    return (
      <main className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[rgb(var(--text-3))]" />
      </main>
    )
  }

  const activeBoard = boardId ? boards.find(b => b.id === boardId) : null

  return (
    <main className="flex h-full flex-col overflow-hidden bg-[rgb(var(--bg))]">
      <VaultBanner />
      <ErrorBoundary resetKeys={[boardId]}>
        {activeBoard ? (
          <BoardView board={activeBoard} />
        ) : (
          <BoardList boards={[...boards].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} />
        )}
      </ErrorBoundary>
    </main>
  )
}
