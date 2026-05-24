import { useEffect, useRef, useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { BoardHeader } from './BoardHeader'
import { BoardColumns } from './BoardColumns'
import { TaskDetailPanel } from '../TaskDetail/TaskDetailPanel'
import { BoardSettings } from '../BoardSettings/BoardSettings'
import { useAppStore } from '../../../../store/useAppStore'
import { eventMatchesAction } from '../../../../hooks/useShortcutKey'
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
  const [drawerWidth, setDrawerWidth]   = useState(520)
  const resizeState = useRef<{ startX: number; startW: number } | null>(null)

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    resizeState.current = { startX: e.clientX, startW: drawerWidth }
    const onMove = (ev: MouseEvent) => {
      if (!resizeState.current) return
      const delta = resizeState.current.startX - ev.clientX
      setDrawerWidth(Math.min(900, Math.max(380, resizeState.current.startW + delta)))
    }
    const onUp = () => {
      resizeState.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const keyBindings  = useAppStore(s => s.keyBindings)
  const createTask   = useKanbanStore(s => s.createTask)
  const activeTask   = board.tasks.find(t => t.id === activeTaskId) ?? null

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (eventMatchesAction(e, 'close-panel', keyBindings)) {
        if (showSettings) { setShowSettings(false); return }
        if (activeTaskId) { setActiveTaskId(null); return }
      }
      if (eventMatchesAction(e, 'redo', keyBindings)) {
        e.preventDefault()
        redo(board.id)
      } else if (eventMatchesAction(e, 'undo', keyBindings)) {
        e.preventDefault()
        undo(board.id)
      } else if (eventMatchesAction(e, 'new-task', keyBindings)) {
        e.preventDefault()
        const firstCol = board.columns[0]
        if (firstCol) {
          const taskId = createTask(board.id, firstCol.id, 'New task')
          setActiveTaskId(taskId)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTaskId, board.id, board.columns, showSettings, undo, redo, setActiveTaskId, createTask, keyBindings])

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
          <aside
            className="fixed inset-y-0 right-0 z-50 flex flex-col border-l border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl"
            style={{ width: `min(${drawerWidth}px, 100vw)` }}
          >
            {/* Resize handle */}
            <div
              onMouseDown={startResize}
              className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize opacity-0 transition-opacity hover:opacity-100 hover:bg-[rgb(var(--accent))]/40 active:opacity-100 active:bg-[rgb(var(--accent))]/60"
            />
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
