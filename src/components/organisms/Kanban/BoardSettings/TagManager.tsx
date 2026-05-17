import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useConfirmStore } from '../../../../store/useConfirmStore'
import { ColorPicker } from '../../../molecules/ColorPicker'
import { nextTagColor } from '../../../../utils/kanban'
import type { Board } from '../../../../types/kanban.types'

interface TagManagerProps {
  board: Board
}

export function TagManager({ board }: TagManagerProps): JSX.Element {
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const addBoardTag = useKanbanStore(s => s.addBoardTag)
  const updateBoardTag = useKanbanStore(s => s.updateBoardTag)
  const deleteBoardTag = useKanbanStore(s => s.deleteBoardTag)

  function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed || board.boardTags.some(t => t.name === trimmed)) return
    addBoardTag(board.id, trimmed)
    setNewName('')
  }

  function startEdit(name: string) {
    setEditingName(name)
    setEditValue(name)
  }

  function saveEdit(oldName: string) {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== oldName) {
      updateBoardTag(board.id, oldName, { name: trimmed })
    }
    setEditingName(null)
  }

  function handleDelete(name: string) {
    const tasksWithTag = board.tasks.filter(t => t.tags.includes(name))
    const msg = tasksWithTag.length > 0
      ? `This tag is used on ${tasksWithTag.length} task${tasksWithTag.length !== 1 ? 's' : ''}. Removing it will update all tasks.`
      : 'This tag will be permanently deleted.'
    void useConfirmStore.getState().confirm({ title: `Delete tag "${name}"?`, message: msg, confirmLabel: 'Delete', danger: true })
      .then(confirmed => { if (confirmed) deleteBoardTag(board.id, name) })
  }

  const usageCount = (name: string) => board.tasks.filter(t => t.tags.includes(name)).length

  return (
    <div className="flex flex-col gap-3">
      {board.boardTags.length === 0 && (
        <p className="text-sm text-[rgb(var(--text-3))]">No tags yet. Create tags here or add them directly to tasks.</p>
      )}
      {board.boardTags.map(tag => (
        <div key={tag.name} className="group flex flex-col gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 flex-shrink-0 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {editingName === tag.name ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => saveEdit(tag.name)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(tag.name); if (e.key === 'Escape') setEditingName(null) }}
                className="flex-1 rounded bg-[rgb(var(--surface))] px-1.5 py-0.5 text-sm outline-none ring-1 ring-[rgb(var(--accent))]"
              />
            ) : (
              <button
                className="flex-1 text-left text-sm font-medium text-[rgb(var(--text))] hover:text-[rgb(var(--accent))]"
                onDoubleClick={() => startEdit(tag.name)}
              >
                {tag.name}
              </button>
            )}
            <span className="text-xs text-[rgb(var(--text-3))]">{usageCount(tag.name)} task{usageCount(tag.name) !== 1 ? 's' : ''}</span>
            <button
              onClick={() => handleDelete(tag.name)}
              className="text-[rgb(var(--text-3))] opacity-0 transition hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <ColorPicker
            value={tag.color}
            onChange={color => updateBoardTag(board.id, tag.name, { color })}
          />
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New tag name…"
          className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-sm font-medium text-[rgb(var(--accent-fg))] transition hover:opacity-90 disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
