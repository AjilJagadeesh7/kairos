import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../db/schema'
import { Button } from '../../../atoms/Button'
import { Checkbox } from '../../../atoms/Checkbox'
import { IconButton } from '../../../atoms/IconButton'
import { ModalShell } from '../../../molecules/ModalShell'
import { EmptyState } from '../../../molecules/EmptyState'

interface Props {
  attached: string[]
  onChange: (ids: string[]) => void
  /** This thread's own id, which can't be attached to itself. */
  excludeId?: string
}

/**
 * "Add context": attach earlier conversations (bubble or global). They go into
 * the prompt as background text only — attaching never widens what the
 * current chat or bubble may read or change.
 */
export function AttachChatsButton({ attached, onChange, excludeId }: Props) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>(attached)
  const chats = useLiveQuery(() => (open ? db.aiChats.orderBy('updatedAt').reverse().limit(100).toArray() : []), [open]) ?? []
  const list = chats.filter((c) => c.id !== excludeId)

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <>
      <span className="relative">
        <IconButton
          icon="paperclip"
          label={attached.length ? `Context: ${attached.length} conversation${attached.length === 1 ? '' : 's'} attached` : 'Add context from earlier conversations'}
          size="sm"
          onClick={() => { setPicked(attached); setOpen(true) }}
        />
        {attached.length > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-fg">
            {attached.length}
          </span>
        )}
      </span>
      {open && (
        <ModalShell onClose={() => setOpen(false)} zIndex="z-[70]" className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text">Add context</p>
            <p className="text-[12px] text-text3">Attach earlier conversations. They are sent as background text — trimmed, or summarized when long.</p>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
            {list.length === 0 ? (
              <EmptyState icon="history" title="No earlier conversations" description="Bubble and chat conversations appear here once saved." />
            ) : (
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface2">
                      <Checkbox checked={picked.includes(c.id)} label={c.title} size="md" onChange={() => toggle(c.id)} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{c.title}</span>
                      <span className="shrink-0 text-[11px] text-text3">{new Date(c.updatedAt).toLocaleDateString()}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" size="md" onClick={() => { onChange(picked); setOpen(false) }}>
              {picked.length ? `Attach ${picked.length}` : 'Attach none'}
            </Button>
          </div>
        </ModalShell>
      )}
    </>
  )
}
