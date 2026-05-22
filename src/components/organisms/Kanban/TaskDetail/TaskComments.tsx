import { useState } from 'react'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import { formatDate } from '../../../../utils/kanban'
import type { KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface TaskCommentsProps {
  boardId: string
  task: KanbanTask
}

export function TaskComments({ boardId, task }: TaskCommentsProps): JSX.Element {
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addComment    = useKanbanStore(s => s.addComment)
  const deleteComment = useKanbanStore(s => s.deleteComment)

  const handleAddComment = async () => {
    const trimmed = newComment.trim()
    if (!trimmed) return
    setIsSubmitting(true)
    try {
      addComment(boardId, task.id, trimmed)
      setNewComment('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleAddComment()
    }
  }

  const comments = task.comments ?? []

  return (
    <section className="mb-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
        Comments
      </h3>

      {/* Comments list — borderless, text-first */}
      <div className="mb-4 space-y-1 max-h-52 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-[rgb(var(--text-3))]">No comments yet</p>
        ) : (
          comments.map(comment => (
            <div
              key={comment.id}
              className="group flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-[rgb(var(--surface-2))] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[rgb(var(--text))] whitespace-pre-wrap break-words leading-relaxed">
                  {comment.content}
                </p>
                <p className="mt-0.5 text-[10px] text-[rgb(var(--text-3))]">
                  {formatDate(comment.createdAt)}
                </p>
              </div>
              <button
                onClick={() => deleteComment(boardId, task.id, comment.id)}
                className="mt-0.5 flex-shrink-0 rounded p-1 text-[rgb(var(--text-3))] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                title="Delete comment"
              >
                <Icon name="trash-2" size={11} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add comment input */}
      <div className="relative flex items-end rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] focus-within:border-[rgb(var(--accent))] transition-colors">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment… (Ctrl+Enter)"
          rows={2}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[rgb(var(--text))] outline-none placeholder-[rgb(var(--text-3))]"
        />
        <button
          onClick={() => void handleAddComment()}
          disabled={!newComment.trim() || isSubmitting}
          className="mb-1.5 mr-1.5 flex-shrink-0 rounded-md p-1.5 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/10 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Send (Ctrl+Enter)"
        >
          <Icon name="send" size={15} />
        </button>
      </div>
    </section>
  )
}
