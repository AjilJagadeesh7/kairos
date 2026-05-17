import { useState, useEffect } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { MarkdownEditor } from '../../Editor/MarkdownEditor'
import type { KanbanTask } from '../../../../types/kanban.types'

interface TaskDescriptionEditorProps {
  boardId: string
  task: KanbanTask
}

export function TaskDescriptionEditor({ boardId, task }: TaskDescriptionEditorProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [description, setDescription] = useState(task.description ?? '')

  const updateTask = useKanbanStore(s => s.updateTask)

  useEffect(() => {
    setDescription(task.description ?? '')
  }, [task.id, task.description])

  const handleSave = () => {
    updateTask(boardId, task.id, { description: description.trim() || undefined })
    setIsEditing(false)
  }

  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
        Description
      </h3>

      {isEditing ? (
        <div className="rounded-lg border border-[rgb(var(--border))] overflow-hidden flex flex-col max-h-96">
          <div className="flex-1 overflow-hidden min-h-0">
            <MarkdownEditor
              noteId={`task-${task.id}`}
              initialMarkdown={description}
              noteTitle={task.title}
              onChange={(content) => setDescription(content)}
              onWikilinkClick={() => {}}
            />
          </div>
          <div className="flex gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-2 flex-shrink-0">
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-medium text-white hover:bg-[rgb(var(--accent))]/90"
            >
              Save
            </button>
            <button
              onClick={() => {
                setDescription(task.description ?? '')
                setIsEditing(false)
              }}
              className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="min-h-[100px] cursor-text rounded-lg border border-transparent p-2 text-sm text-[rgb(var(--text-2))] hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))]"
        >
          {task.description ? (
            <pre className="whitespace-pre-wrap font-sans text-[rgb(var(--text))]">
              {task.description}
            </pre>
          ) : (
            <span className="text-[rgb(var(--text-3))]">Add a description…</span>
          )}
        </div>
      )}
    </section>
  )
}
