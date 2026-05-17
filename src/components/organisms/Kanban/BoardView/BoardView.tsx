import { useEffect, useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { BoardHeader } from './BoardHeader'
import { BoardColumns } from './BoardColumns'
import { TaskDetailPanel } from '../TaskDetail/TaskDetailPanel'
import { BoardSettings } from '../BoardSettings/BoardSettings'
import type { Board } from '../../../../types/kanban.types'

interface BoardViewProps {
  board: Board
}

export function BoardView({ board }: BoardViewProps): JSX.Element {
  const activeTaskId    = useKanbanStore(s => s.activeTaskId)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)
  const undo            = useKanbanStore(s => s.undo)
  const redo            = useKanbanStore(s => s.redo)
  const [showSettings, setShowSettings] = useState(false)

  const activeTask = board.tasks.find(t => t.id === activeTaskId) ?? null

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (e.key === 'Escape') {
        if (showSettings) { setShowSettings(false); return }
        if (activeTaskId) { setActiveTaskId(null); return }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(board.id)
        else undo(board.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTaskId, board.id, showSettings, undo, redo, setActiveTaskId])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Single combined header bar — title + filters + actions */}
      <BoardHeader board={board} onOpenSettings={() => setShowSettings(true)} />

      {/* Board columns fill all remaining space */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <BoardColumns board={board} />
      </div>

      {/* ── Task detail drawer — slides in from the right, overlays the board ── */}
      {activeTask && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setActiveTaskId(null)}
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 right-0 z-50 flex w-[600px] max-w-full flex-col border-l border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl">
            <TaskDetailPanel
              task={activeTask}
              board={board}
              onClose={() => setActiveTaskId(null)}
            />
          </aside>
        </>
      )}

      {/* Board settings modal */}
      {showSettings && (
        <BoardSettings board={board} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
