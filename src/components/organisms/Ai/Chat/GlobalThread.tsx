import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../atoms/Button'
import { LocationBadge } from '../../../atoms/LocationBadge'
import { EmptyState } from '../../../molecules/EmptyState'
import { Icon } from '../../../../icons/Icon'
import { BubbleMessageFrame, BubbleReplyText } from '../Bubble/BubbleMessageFrame'
import { ChatComposer } from '../Bubble/ChatComposer'
import { AttachChatsButton } from './AttachChatsButton'
import { VaultFactsView } from './VaultFactsView'
import { SourceChips } from './SourceChips'
import { useGlobalChat } from '../../../../hooks/useGlobalChat'
import { destinationLabel, locationForUrl } from '../../../../ai/net/urlPolicy'
import type { AiChatRecord } from '../../../../types'

interface Props {
  record: AiChatRecord
  onSaved: (record: AiChatRecord) => void
}

/** A global chat thread: read-only over the vault, with facts and source chips. */
export function GlobalThread({ record, onSaved }: Props) {
  const navigate = useNavigate()
  const chat = useGlobalChat(record, onSaved)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [chat.messages, chat.progress])

  const location = chat.config ? locationForUrl(chat.config.baseUrl) : null
  const openSettings = () => navigate('/settings?section=ai')

  if (!chat.config) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon="sparkles"
          title="Choose a provider for the global chat"
          description="Add a provider and pass Test connection in Settings → AI, then pick it for the global chat."
          action={{ label: 'Open AI settings', onClick: openSettings }}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{chat.messages.length ? 'Chat' : 'New chat'}</p>
          {location && (
            <p className="flex items-center gap-1.5 text-[11px] text-text3">
              <LocationBadge location={location} />
              <span className="truncate">{destinationLabel(location, chat.config.name)}</span>
            </p>
          )}
        </div>
        {chat.attached.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-text3"><Icon name="paperclip" size={11} /> {chat.attached.length} attached</span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {!chat.messages.length && (
            <div className="space-y-1 py-6 text-center">
              <Icon name="sparkles" size={22} className="mx-auto text-text3" />
              <p className="text-sm font-medium text-text">Ask about your notes and boards</p>
              <p className="text-[12px] text-text3">Reads across your vault; it can't change anything from here. Answers list the notes and cards they used.</p>
            </div>
          )}
          {chat.messages.map((m) => (
            <BubbleMessageFrame key={m.id} message={m} onSwitchProvider={openSettings}>
              {m.vaultFacts && <VaultFactsView facts={m.vaultFacts} />}
              {(m.content || m.streaming || !m.vaultFacts) && <BubbleReplyText message={m} />}
              {m.sources && <SourceChips sources={m.sources} />}
            </BubbleMessageFrame>
          ))}
          {chat.progress && <p className="text-[11px] text-text3">{chat.progress}</p>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border px-4 py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            <Button variant="hollow" size="xs" disabled={chat.busy} onClick={() => void chat.pending()}>
              <Icon name="list" size={12} /> What's pending this week?
            </Button>
            <Button variant="hollow" size="xs" disabled={chat.busy} onClick={() => void chat.review('day', 'Daily review')}>
              <Icon name="calendar" size={12} /> Daily review
            </Button>
            <Button variant="hollow" size="xs" disabled={chat.busy} onClick={() => void chat.review('week', 'Weekly review')}>
              <Icon name="calendar-days" size={12} /> Weekly review
            </Button>
          </div>
          <ChatComposer
            placeholder="Ask about your notes, e.g. “what did I write about the Go backend?”"
            busy={chat.busy}
            onSend={(text) => void chat.send(text)}
            onStop={chat.stop}
            leading={<AttachChatsButton attached={chat.attached} onChange={chat.setAttached} excludeId={record.id} />}
          />
        </div>
      </div>
    </div>
  )
}
