import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import type { AiChatRecord } from '../../../../types'

/**
 * A saved bubble conversation: read-only (PRD). It can be continued only as
 * a new global chat, with this conversation attached as context.
 */
export function BubbleThread({ record }: { record: AiChatRecord }) {
  const navigate = useNavigate()
  const src = record.source
  const sourcePath = src ? (src.kind === 'note' ? `/notes/${src.id}` : `/kanban/${src.id}`) : null

  // A new thread isn't saved until its first question, so the attachment rides in the URL.
  const continueAsGlobal = () => navigate(`/chat/${uuid()}?attach=${encodeURIComponent(record.id)}`)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{record.title}</p>
          <p className="text-[11px] text-text3">Page bubble · read-only · {new Date(record.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        {sourcePath && (
          <Button variant="hollow" size="sm" onClick={() => navigate(sourcePath)}>
            <Icon name={src!.kind === 'note' ? 'file-text' : 'square-kanban'} size={13} /> Open {src!.kind}
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={continueAsGlobal}>Continue as global chat</Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {record.messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-accent/10 px-3 py-1.5 text-[13px] text-text">
                {m.content}
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2">
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text">{m.content}</p>
                {m.outcome && <p className="text-[10px] uppercase tracking-wider text-text3">{m.outcome}</p>}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}
