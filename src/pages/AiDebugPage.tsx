import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAiStore } from '../store/useAiStore'
import { useAiDebugChat } from '../hooks/useAiDebugChat'
import { locationForUrl, destinationLabel } from '../ai/net/urlPolicy'
import { AiDebugTranscript } from '../components/organisms/Ai/AiDebugTranscript'
import { EmptyState } from '../components/molecules/EmptyState'
import { Button } from '../components/atoms/Button'
import { LocationBadge } from '../components/atoms/LocationBadge'
import { Select } from '../components/atoms/Select'

/** Hidden debug chat (P0): raw streamed output from a configured provider. */
export function AiDebugPage(): JSX.Element {
  const navigate = useNavigate()
  const enabled = useAiStore((s) => s.enabled)
  const providers = useAiStore((s) => s.providers)
  const globalId = useAiStore((s) => s.surfaceProvider.global)
  const verified = providers.filter((p) => p.verified)
  const [picked, setPicked] = useState<string | null>(null)
  const providerId = picked ?? globalId ?? verified[0]?.id ?? null
  const chat = useAiDebugChat(providerId)
  const [input, setInput] = useState('')

  const toSettings = () => navigate('/settings?section=ai')

  if (!enabled || verified.length === 0) {
    return (
      <EmptyState
        icon="sparkles"
        title={enabled ? 'No tested AI provider yet' : 'The AI assistant is off'}
        description={enabled
          ? 'Add a provider and pass Test connection in Settings → AI.'
          : 'Turn it on and add a provider in Settings → AI.'}
        action={{ label: 'Open AI settings', onClick: toSettings }}
        className="mt-24"
      />
    )
  }

  function submit() {
    if (chat.busy || !input.trim()) return
    void chat.send(input)
    setInput('')
  }

  const location = chat.config ? locationForUrl(chat.config.baseUrl) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="text-sm font-semibold text-text">AI debug chat</h1>
        <Select
          value={providerId ?? ''}
          options={verified.map((p) => ({ value: p.id, label: `${p.name} · ${p.model}` }))}
          onChange={(v) => { if (!chat.busy) setPicked(v) }}
        />
        {chat.config && location && (
          <span className="flex items-center gap-1.5 text-[11px] text-text3">
            <LocationBadge location={location} />
            Sending to {destinationLabel(location, chat.config.name)}
          </span>
        )}
        <div className="ml-auto flex gap-1.5">
          <Button variant="hollow" size="xs" disabled={chat.busy} onClick={() => void chat.jsonCheck()}>JSON check ×20</Button>
          <Button variant="ghost" size="xs" disabled={chat.busy} onClick={chat.clear}>Clear</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AiDebugTranscript turns={chat.turns} check={chat.check} busy={chat.busy} onSwitchProvider={toSettings} />
      </div>

      <div className="border-t border-border p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder="Message the model — Enter to send, Shift+Enter for a new line"
            rows={2}
            className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-text2"
          />
          {chat.busy
            ? <Button variant="danger" size="md" onClick={chat.stop}>Stop</Button>
            : <Button variant="primary" size="md" disabled={!input.trim()} onClick={submit}>Send</Button>}
        </div>
      </div>
    </div>
  )
}
