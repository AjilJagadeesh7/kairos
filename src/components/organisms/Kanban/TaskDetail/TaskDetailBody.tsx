import { useKanbanStore } from '../../../../store/useKanbanStore'
import { useConfirmStore } from '../../../../store/useConfirmStore'
import { SubtaskList } from './SubtaskList'
import { ChildIssues } from './ChildIssues'
import { LinkedNotes } from './LinkedNotes'
import { LinkedTasks } from './LinkedTasks'
import { TaskDescriptionEditor } from './TaskDescriptionEditor'
import { TaskComments } from './TaskComments'
import { TaskAttachments } from './TaskAttachments'
import { TaskTitleEditor } from './TaskTitleEditor'
import { StatusSelect } from './StatusSelect'
import { TaskDetailsSidebar } from './TaskDetailsSidebar'
import type { Board, KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  task: KanbanTask
  board: Board
  onOpen: (taskId: string) => void
  /** 'page' → two columns on wide screens; 'drawer' → always stacked. */
  variant?: 'page' | 'drawer'
  /** Called after the issue is deleted (e.g. navigate away). */
  onDeleted?: () => void
}

function SectionHeading({ icon, children }: { icon: Parameters<typeof Icon>[0]['name']; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
      <Icon name={icon} size={12} /> {children}
    </h3>
  )
}

/** Shared two-column task detail content (Jira-style). */
export function TaskDetailBody({ task, board, onOpen, variant = 'drawer', onDeleted }: Props): JSX.Element {
  const deleteTask = useKanbanStore(s => s.deleteTask)

  function handleDelete() {
    void useConfirmStore.getState().confirm({
      title: `Delete ${task.key}?`,
      message: 'This issue will be permanently deleted.',
      confirmLabel: 'Delete',
      danger: true,
    }).then(ok => { if (ok) { deleteTask(board.id, task.id); onDeleted?.() } })
  }

  const container = variant === 'page' ? 'flex flex-col gap-6 lg:flex-row' : 'flex flex-col gap-5'
  const asideCls = variant === 'page' ? 'w-full shrink-0 lg:w-80' : 'w-full'

  return (
    <div className={container}>
      <main className="min-w-0 flex-1">
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1"><TaskTitleEditor boardId={board.id} taskId={task.id} title={task.title} /></div>
        </div>

        <div className="mb-5 flex items-center gap-2">
          <StatusSelect board={board} task={task} />
          <button onClick={handleDelete} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[rgb(var(--text-3))] transition hover:bg-red-500/10 hover:text-red-500" title="Delete issue">
            <Icon name="trash-2" size={14} />
          </button>
        </div>

        <TaskDescriptionEditor boardId={board.id} task={task} />

        <TaskAttachments boardId={board.id} task={task} />

        {task.type !== 'subtask' && (
          <section className="mb-5">
            <SectionHeading icon="git-fork">Child issues</SectionHeading>
            <ChildIssues board={board} task={task} onOpen={onOpen} />
          </section>
        )}

        {task.subtasks.length > 0 && (
          <section className="mb-5">
            <SectionHeading icon="list">Checklist</SectionHeading>
            <SubtaskList boardId={board.id} task={task} />
          </section>
        )}

        <section className="mb-5">
          <SectionHeading icon="file-text">Linked notes{task.linkedNotes.length > 0 ? ` (${task.linkedNotes.length})` : ''}</SectionHeading>
          <LinkedNotes boardId={board.id} task={task} />
        </section>

        <section className="mb-5">
          <SectionHeading icon="link-2">Linked work items{task.linkedTasks.length > 0 ? ` (${task.linkedTasks.length})` : ''}</SectionHeading>
          <LinkedTasks boardId={board.id} board={board} task={task} />
        </section>

        <TaskComments boardId={board.id} task={task} />
      </main>

      <aside className={asideCls}>
        <TaskDetailsSidebar board={board} task={task} onOpen={onOpen} />
      </aside>
    </div>
  )
}
