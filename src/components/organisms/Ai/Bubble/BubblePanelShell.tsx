import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../atoms/Button'
import { IconButton } from '../../../atoms/IconButton'
import { LocationBadge } from '../../../atoms/LocationBadge'
import { EmptyState } from '../../../molecules/EmptyState'
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
  renderMessage: (message: BubbleMessage, openSettings: () => void) => ReactNode
  quickActions: ReactNode
  onSend: (text: string) => void
  onStop: () => void
  onClear: () => void
  onClose: () => void
}

/** Frame shared by every page bubble: header, provider setup card, messages, composer. */
export function BubblePanelShell(props: BubblePanelShellProps) {
  const { config, messages, busy, progress } = props
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, progress])

  const openSettings = () => navigate('/settings?section=ai')
  const location = config ? locationForUrl(config.baseUrl) : null

  function send() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    props.onSend(text)
  }

  return (
    <div
      role="dialog"
      aria-label={props.ariaLabel}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); props.onClose() } }}
      className="fixed inset-x-0 bottom-0 z-[55] flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-2xl
        md:absolute md:inset-x-auto md:bottom-4 md:right-4 md:max-h-[min(640px,calc(100%-2rem))] md:w-[400px] md:rounded-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text">{props.title}</p>
          {config && location && (
            <p className="flex items-center gap-1.5 truncate text-[11px] text-text3">
              <LocationBadge location={location} />
              <span className="truncate">{destinationLabel(location, config.name)}</span>
            </p>
          )}
        </div>
        <IconButton icon="eraser" label="Clear conversation" size="sm" disabled={!messages.length} onClick={props.onClear} />
        <IconButton icon="x" label="Close" size="sm" onClick={props.onClose} />
      </header>

      {!config ? (
        <div className="p-4">
          <EmptyState
            icon="sparkles"
            title="Choose a provider for the page bubble"
            description="Add a provider and pass Test connection in Settings → AI, then pick it for the page bubble."
            action={{ label: 'Open AI settings', onClick: openSettings }}
          />
        </div>
      ) : (
        <>
          <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {!messages.length && <p className="text-[12px] text-text3">{props.intro}</p>}
            {messages.map((m) => props.renderMessage(m, openSettings))}
            {progress && <p className="text-[11px] text-text3">{progress}</p>}
            <div ref={endRef} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
            {props.quickActions}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={1}
                placeholder={props.placeholder}
                className="max-h-28 min-h-[34px] flex-1 resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text outline-none placeholder:text-text3 focus:border-accent"
              />
              {busy
                ? <Button variant="hollow" size="md" onClick={props.onStop}>Stop</Button>
                : <Button variant="primary" size="md" disabled={!draft.trim()} onClick={send}>Send</Button>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
