import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from '../../../atoms/IconButton'
import { LocationBadge } from '../../../atoms/LocationBadge'
import { EmptyState } from '../../../molecules/EmptyState'
import { Icon } from '../../../../icons/Icon'
import { ChatComposer } from './ChatComposer'
import { AttachChatsButton } from '../Chat/AttachChatsButton'
import { useAiStore } from '../../../../store/useAiStore'
import { destinationLabel, locationForUrl } from '../../../../ai/net/urlPolicy'
import type { AiProviderConfig, BubbleMessage } from '../../../../types'

interface BubblePanelShellProps {
  /** e.g. "Ask AI · this note" */
  title: string
  ariaLabel: string
  placeholder: string
  /** Shown while the conversation is empty. */
  intro: string
  config: AiProviderConfig | null
  messages: BubbleMessage[]
  busy: boolean
  progress: string | null
  /** Conversations attached as context ("Add context"). */
  attached: string[]
  onAttach: (ids: string[]) => void
  renderMessage: (message: BubbleMessage, openSettings: () => void) => ReactNode
  /** Suggested first actions, shown only while the conversation is empty. */
  starters?: ReactNode
  /** Extra tools in the composer, next to "Add context". */
  tools?: ReactNode
  /** Floats above the composer (e.g. the prompt menu). */
  overlay?: ReactNode
  /** A line above the composer (e.g. "Edits allowed in this chat"). */
  banner?: ReactNode
  /** Saves the session and returns its id, to continue it on the chat page. */
  saveNow?: () => Promise<string | null>
  onSend: (text: string) => void
  onStop: () => void
  onClear: () => void
  onClose: () => void
}

/** Frame shared by every page bubble: header, provider setup card, messages, composer. */
export function BubblePanelShell(props: BubblePanelShellProps) {
  const { config, messages, progress, saveNow } = props
  const navigate = useNavigate()
  const historyOff = useAiStore((s) => s.chatRetention === 'never')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, progress])

  const openSettings = () => navigate('/settings?section=ai')
  const location = config ? locationForUrl(config.baseUrl) : null

  async function openInChat() {
    const id = await saveNow?.()
    if (!id) return
    props.onClose()
    navigate(`/chat/${id}`)
  }

  return (
    <div
      role="dialog"
      aria-label={props.ariaLabel}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); props.onClose() } }}
      className="fixed inset-x-0 bottom-0 z-[55] flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-2xl
        md:absolute md:inset-x-auto md:bottom-4 md:right-4 md:max-h-[min(680px,calc(100%-2rem))] md:w-[420px] md:rounded-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <header className="flex items-center gap-1.5 py-1.5 pl-3 pr-1.5">
        <Icon name="sparkles" size={14} className="shrink-0 text-text3" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{props.title}</p>
        {config && location && (
          <span title={destinationLabel(location, config.name)}><LocationBadge location={location} /></span>
        )}
        {saveNow && (
          <IconButton
            icon="message-square" size="sm" disabled={!messages.length || historyOff || props.busy} onClick={() => void openInChat()}
            label={historyOff ? 'Chat history is off — turn it on in Settings → AI to continue chats in AI chat' : 'Continue in AI chat'}
            title={historyOff ? 'Chat history is off' : 'Continue in AI chat'}
          />
        )}
        <IconButton icon="eraser" label="Clear conversation" title="New conversation" size="sm" disabled={!messages.length} onClick={props.onClear} />
        <IconButton icon="x" label="Close" size="sm" onClick={props.onClose} />
      </header>

      {!config ? (
        <div className="border-t border-border p-4">
          <EmptyState
            icon="sparkles"
            title="Choose a provider for the page bubble"
            description="Add a provider and pass Test connection in Settings → AI, then pick it for the page bubble."
            action={{ label: 'Open AI settings', onClick: openSettings }}
          />
        </div>
      ) : (
        <>
          <div className="flex min-h-[140px] flex-1 flex-col gap-3 overflow-y-auto border-t border-border px-3 py-3">
            {!messages.length && (
              <div className="flex flex-col gap-3 py-1">
                <p className="text-[12px] leading-relaxed text-text3">{props.intro}</p>
                {props.starters}
              </div>
            )}
            {messages.map((m) => props.renderMessage(m, openSettings))}
            {progress && <p className="animate-pulse text-[11px] text-text3">{progress}</p>}
            <div ref={endRef} />
          </div>

          <div className="relative flex flex-col gap-1.5 px-2.5 pb-2.5 pt-1">
            {props.overlay}
            {props.banner}
            <ChatComposer
              placeholder={props.placeholder}
              busy={props.busy}
              onSend={props.onSend}
              onStop={props.onStop}
              leading={<><AttachChatsButton attached={props.attached} onChange={props.onAttach} />{props.tools}</>}
            />
          </div>
        </>
      )}
    </div>
  )
}
