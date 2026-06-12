import { useEffect, useRef, useState } from 'react'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import { Button } from '../../../atoms/Button'
import { IconButton } from '../../../atoms/IconButton'
import { Icon } from '../../../../icons/Icon'

interface AddTaskInlineProps {
  boardId: string
  columnId: string
}

export function AddTaskInline({ boardId, columnId }: AddTaskInlineProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const createTask = useKanbanStore(s => s.createTask)
  const setActiveTaskId = useKanbanStore(s => s.setActiveTaskId)

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) return
    const id = createTask(boardId, columnId, trimmed)
    setTitle('')
    setIsOpen(false)
    setActiveTaskId(id)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setTitle('')
    }
  }

  if (!isOpen) {
    return (
      <button
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text-2))]"
        onClick={() => setIsOpen(true)}
      >
        <Icon name="plus" size={13} /> Add task
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--surface))] p-2 shadow-sm">
      <textarea
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title…"
        rows={2}
        className="w-full resize-none bg-transparent text-sm text-[rgb(var(--text))] placeholder-[rgb(var(--text-3))] outline-none"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <Button variant="submit" size="xs" onClick={handleSubmit} disabled={!title.trim()}>
          Add
        </Button>
        <IconButton icon="x" label="Cancel" size="xs" onClick={() => { setIsOpen(false); setTitle('') }} />
      </div>
    </div>
  )
}
