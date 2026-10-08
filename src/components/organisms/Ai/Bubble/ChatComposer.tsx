import { useState } from 'react'
import { Button } from '../../../atoms/Button'

interface Props {
  placeholder: string
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
  /** Rendered before the text box, e.g. an "Add context" button. */
  leading?: React.ReactNode
}

/** Text box + Send / Stop, shared by the bubbles and the chat page. Enter sends, Shift+Enter breaks a line. */
export function ChatComposer({ placeholder, busy, onSend, onStop, leading }: Props) {
  const [draft, setDraft] = useState('')

  function send() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    onSend(text)
  }

  return (
    <div className="flex items-end gap-2">
      {leading}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        rows={1}
        placeholder={placeholder}
        className="max-h-28 min-h-[34px] flex-1 resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text outline-none placeholder:text-text3 focus:border-accent"
      />
      {busy
        ? <Button variant="hollow" size="md" onClick={onStop}>Stop</Button>
        : <Button variant="primary" size="md" disabled={!draft.trim()} onClick={send}>Send</Button>}
    </div>
  )
}
