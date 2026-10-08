import { Button } from '../../../atoms/Button'
import { IconButton } from '../../../atoms/IconButton'
import { SectionLabel } from '../../../atoms/SectionLabel'
import { Icon } from '../../../../icons/Icon'
import type { AiChatRecord } from '../../../../types'

interface Props {
  chats: AiChatRecord[]
  activeId: string | null
  onOpen: (id: string) => void
  onNew: () => void
  onDelete: (chat: AiChatRecord) => void
}

function Row({ chat, active, onOpen, onDelete }: { chat: AiChatRecord; active: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <li className={`group flex items-center gap-1 rounded-md pr-1 ${active ? 'bg-surface2' : 'hover:bg-surface2/60'}`}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left">
        <Icon
          name={chat.surface === 'global' ? 'sparkles' : chat.source?.kind === 'board' ? 'square-kanban' : 'file-text'}
          size={13}
          className="shrink-0 text-text3"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text">{chat.title}</span>
          <span className="block text-[10px] text-text3">{new Date(chat.updatedAt).toLocaleDateString()} · {chat.messages.length} messages</span>
        </span>
      </button>
      <IconButton
        icon="trash-2" size="xs" label={`Delete ${chat.title}`} onClick={onDelete}
        className="opacity-60 group-hover:opacity-100 md:opacity-0 md:focus:opacity-100"
      />
    </li>
  )
}

/** Global threads first, then saved bubble conversations (read-only). */
export function ChatList({ chats, activeId, onOpen, onNew, onDelete }: Props) {
  const global = chats.filter((c) => c.surface === 'global')
  const bubble = chats.filter((c) => c.surface === 'bubble')
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-sm font-semibold text-text">AI chat</p>
        <Button variant="hollow" size="sm" onClick={onNew}><Icon name="plus" size={13} /> New chat</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <SectionLabel className="px-2 pb-1">Chats</SectionLabel>
        {global.length === 0
          ? <p className="px-2 pb-2 text-[12px] text-text3">No chats yet.</p>
          : <ul className="pb-2">{global.map((c) => <Row key={c.id} chat={c} active={c.id === activeId} onOpen={() => onOpen(c.id)} onDelete={() => onDelete(c)} />)}</ul>}
        <SectionLabel className="px-2 pb-1 pt-2">From page bubbles</SectionLabel>
        {bubble.length === 0
          ? <p className="px-2 text-[12px] text-text3">Bubble conversations appear here when you close a bubble.</p>
          : <ul>{bubble.map((c) => <Row key={c.id} chat={c} active={c.id === activeId} onOpen={() => onOpen(c.id)} onDelete={() => onDelete(c)} />)}</ul>}
      </div>
    </div>
  )
}
