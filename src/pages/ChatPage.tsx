import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db } from '../db/schema'
import { useAiStore } from '../store/useAiStore'
import { useConfirmStore } from '../store/useConfirmStore'
import { deleteChat } from '../ai/history/chatStore'
import { EmptyState } from '../components/molecules/EmptyState'
import { IconButton } from '../components/atoms/IconButton'
import { ChatList } from '../components/organisms/Ai/Chat/ChatList'
import { GlobalThread } from '../components/organisms/Ai/Chat/GlobalThread'
import { BubbleThread } from '../components/organisms/Ai/Chat/BubbleThread'
import type { AiChatRecord } from '../types'

function emptyThread(id: string, attach: string[]): AiChatRecord {
  const now = new Date().toISOString()
  return { id, surface: 'global', title: 'New chat', source: null, attachedChatIds: attach, provider: null, messages: [], createdAt: now, updatedAt: now }
}

/** Mounts one thread with the record as it was when opened; later saves don't reset it. */
function ThreadHost({ loaded, id, attach, onSaved }: { loaded: AiChatRecord | null; id: string; attach: string[]; onSaved: (r: AiChatRecord) => void }) {
  const [initial] = useState(() => loaded ?? emptyThread(id, attach))
  return initial.surface === 'bubble' ? <BubbleThread record={initial} /> : <GlobalThread record={initial} onSaved={onSaved} />
}

/** The global chat: persistent threads over the whole vault, plus saved bubble conversations. */
export function ChatPage(): JSX.Element {
  const { chatId } = useParams<{ chatId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const enabled = useAiStore((s) => s.enabled)
  const retention = useAiStore((s) => s.chatRetention)
  const confirm = useConfirmStore((s) => s.confirm)

  // A fresh draft id whenever the page is opened without a thread.
  const draftId = useMemo(() => uuid(), [chatId]) // eslint-disable-line react-hooks/exhaustive-deps
  const threadId = chatId ?? draftId
  const attach = useMemo(() => new URLSearchParams(location.search).getAll('attach'), [location.search])

  const chats = useLiveQuery(() => db.aiChats.orderBy('updatedAt').reverse().toArray(), []) ?? []
  // Tagged with its id: right after the id changes, useLiveQuery still holds the previous result.
  const query = useLiveQuery(() => db.aiChats.get(threadId).then((r) => ({ id: threadId, record: r ?? null })), [threadId])
  const loaded = query?.id === threadId ? query.record : undefined

  const onSaved = useCallback((r: AiChatRecord) => {
    if (!chatId) navigate(`/chat/${r.id}`, { replace: true })
  }, [chatId, navigate])

  async function remove(chat: AiChatRecord) {
    const ok = await confirm({ title: `Delete "${chat.title}"?`, message: 'The conversation is removed from this device. Notes and cards are not affected.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await deleteChat(chat.id)
    if (chat.id === threadId) navigate('/chat')
  }

  if (!enabled) {
    return (
      <main className="flex h-full items-center justify-center bg-bg p-6">
        <EmptyState icon="sparkles" title="The AI assistant is off" description="Turn it on in Settings → AI to chat with your notes and boards." action={{ label: 'Open AI settings', onClick: () => navigate('/settings?section=ai') }} />
      </main>
    )
  }

  return (
    <main className="flex h-full overflow-hidden bg-bg">
      <aside className={`w-full shrink-0 border-r border-border md:block md:w-72 ${chatId ? 'hidden' : 'block'}`}>
        <ChatList chats={chats} activeId={chatId ?? null} onOpen={(id) => navigate(`/chat/${id}`)} onNew={() => navigate(`/chat/${uuid()}`)} onDelete={(c) => void remove(c)} />
      </aside>
      <section className={`min-w-0 flex-1 flex-col md:flex ${chatId ? 'flex' : 'hidden'}`}>
        {chatId && (
          <div className="flex items-center border-b border-border px-2 py-1 md:hidden">
            <IconButton icon="arrow-left" label="All chats" size="sm" onClick={() => navigate('/chat')} />
          </div>
        )}
        {retention === 'never' && (
          <p className="border-b border-border bg-surface2/60 px-4 py-1.5 text-[11px] text-text3">Chat history is off — this conversation is not saved. Change it in Settings → AI.</p>
        )}
        {loaded === undefined
          ? null
          : <ThreadHost key={threadId} loaded={loaded} id={threadId} attach={attach} onSaved={onSaved} />}
      </section>
    </main>
  )
}
