import { useEffect, useRef, useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { ModalShell } from '../../../molecules/ModalShell'
import { IconButton } from '../../../atoms/IconButton'

interface NewBoardModalProps {
  onClose: () => void
}

export function NewBoardModal({ onClose }: NewBoardModalProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const createBoard = useKanbanStore(s => s.createBoard)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const id = createBoard(title.trim(), description.trim() || undefined)
    navigate(`/kanban/${id}`)
    onClose()
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <ModalShell onClose={onClose} className="rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">New Board</h2>
          <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[rgb(var(--text-2))]">Board Name</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Kairos Development"
              className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] placeholder-[rgb(var(--text-3))] outline-none focus:border-[rgb(var(--accent))]"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[rgb(var(--text-2))]">
              Description <span className="font-normal text-[rgb(var(--text-3))]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this board for?"
              rows={2}
              className="resize-none rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] placeholder-[rgb(var(--text-3))] outline-none focus:border-[rgb(var(--accent))]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={!title.trim()}>
              Create Board
            </Button>
          </div>
        </form>
    </ModalShell>
  )
}
