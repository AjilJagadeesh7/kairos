import { useState, useEffect } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { Button } from '../../../atoms/Button'
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
            <Button variant="submit" size="sm" className="flex-1" onClick={handleSave}>
              Save
            </Button>
            <Button
              variant="hollow"
              size="sm"
              className="flex-1"
              onClick={() => {
                setDescription(task.description ?? '')
                setIsEditing(false)
              }}
            >
              Cancel
            </Button>
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
