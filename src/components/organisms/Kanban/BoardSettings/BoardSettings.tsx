import { useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useConfirmStore } from '../../../../store/useConfirmStore'
import { ColumnManager } from './ColumnManager'
import { TagManager } from './TagManager'
import { ExportOptions } from './ExportOptions'
import type { Board } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'
import { ModalShell } from '../../../molecules/ModalShell'
import { IconButton } from '../../../atoms/IconButton'

type Tab = 'general' | 'columns' | 'tags' | 'export'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'columns', label: 'Columns' },
  { id: 'tags', label: 'Tags' },
  { id: 'export', label: 'Export' },
]

interface BoardSettingsProps {
  board: Board
  onClose: () => void
}

export function BoardSettings({ board, onClose }: BoardSettingsProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [title, setTitle] = useState(board.title)
  const [description, setDescription] = useState(board.description ?? '')
  const navigate = useNavigate()
  const updateBoard = useKanbanStore(s => s.updateBoard)
  const deleteBoard = useKanbanStore(s => s.deleteBoard)
  const duplicateBoard = useKanbanStore(s => s.duplicateBoard)

  function handleSaveGeneral() {
    const trimmed = title.trim()
    if (trimmed) updateBoard(board.id, { title: trimmed, description: description.trim() || undefined })
  }

  function handleDelete() {
    void useConfirmStore.getState().confirm({
      title: `Delete "${board.title}"?`,
      message: 'This will permanently delete the board and all its tasks. This cannot be undone.',
      confirmLabel: 'Delete Board',
      danger: true,
    }).then(confirmed => {
      if (confirmed) {
        deleteBoard(board.id)
        navigate('/kanban')
        onClose()
      }
    })
  }

  function handleDuplicate() {
    const newId = duplicateBoard(board.id)
    navigate(`/kanban/${newId}`)
    onClose()
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl" className="flex h-[600px] flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-text">Board Settings</h2>
          <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Tab list */}
          <div className="flex w-36 flex-col flex-shrink-0 border-r border-[rgb(var(--border))] p-3 gap-0.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeTab === tab.id
                    ? 'bg-[rgb(var(--accent))] font-medium text-[rgb(var(--accent-fg))]'
                    : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'general' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--text-2))]">Board Name</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={handleSaveGeneral}
                    onKeyDown={e => e.key === 'Enter' && handleSaveGeneral()}
                    className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--text-2))]">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onBlur={handleSaveGeneral}
                    rows={3}
                    placeholder="What is this board for?"
                    className="resize-none rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none placeholder-[rgb(var(--text-3))] focus:border-[rgb(var(--accent))]"
                  />
                </div>
                <div className="border-t border-[rgb(var(--border))] pt-4 flex flex-col gap-2">
                  <button
                    onClick={handleDuplicate}
                    className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
                  >
                    <Icon name="copy" size={14} /> Duplicate board
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  >
                    <Icon name="trash-2" size={14} /> Delete board
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'columns' && <ColumnManager board={board} />}
            {activeTab === 'tags' && <TagManager board={board} />}
            {activeTab === 'export' && <ExportOptions board={board} />}
          </div>
        </div>
    </ModalShell>
  )
}
