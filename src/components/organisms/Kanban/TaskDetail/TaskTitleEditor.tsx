import { useEffect, useRef, useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'

interface Props {
  boardId: string
  taskId: string
  title: string
}

export function TaskTitleEditor({ boardId, taskId, title: initialTitle }: Props) {
  const updateTask = useKanbanStore(s => s.updateTask)
  const [editing, setEditing] = useState(false)
  const [title,   setTitle]   = useState(initialTitle)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTitle(initialTitle) }, [taskId, initialTitle])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function save() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== initialTitle) updateTask(boardId, taskId, { title: trimmed })
    else setTitle(initialTitle)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') { setTitle(initialTitle); setEditing(false) }
        }}
        className="mb-4 w-full rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--surface-2))] px-3 py-2 text-lg font-semibold text-[rgb(var(--text))] outline-none"
      />
    )
  }

  return (
    <h2
      className="mb-4 cursor-text text-lg font-semibold leading-snug text-[rgb(var(--text))] hover:text-[rgb(var(--accent))]"
      onClick={() => setEditing(true)}
    >
      {initialTitle}
    </h2>
  )
}
