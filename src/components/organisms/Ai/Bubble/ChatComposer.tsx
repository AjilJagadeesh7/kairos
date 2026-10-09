import { useRef, useState } from 'react'
import { IconButton } from '../../../atoms/IconButton'

interface Props {
  placeholder: string
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
  /** Small tools under the text box, e.g. "Add context" or a prompt menu. */
  leading?: React.ReactNode
}

const MAX_HEIGHT = 160

/**
 * Text box + Send / Stop in one box, shared by the bubbles and the chat page.
 * Enter sends, Shift+Enter breaks a line; the box grows with the text.
 */
export function ChatComposer({ placeholder, busy, onSend, onStop, leading }: Props) {
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function fit() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  function send() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    requestAnimationFrame(fit)
    onSend(text)
  }

  return (
    <div className="rounded-xl border border-border bg-surface transition-colors focus-within:border-text2">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); fit() }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        rows={1}
        placeholder={placeholder}
        aria-label="Message"
        className="block w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[13px] leading-relaxed text-text outline-none placeholder:text-text3 focus-visible:!outline-none"
        style={{ maxHeight: MAX_HEIGHT }}
      />
      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        {leading}
        <span className="flex-1" />
        {busy ? (
          <IconButton icon="square" label="Stop" size="sm" onClick={onStop} className="border border-border" iconClassName="fill-current" />
        ) : (
          <IconButton
            icon="arrow-up" label="Send" size="sm" disabled={!draft.trim()} onClick={send}
            className="!rounded-full bg-accent !text-accent-fg hover:bg-accent/90 disabled:cursor-default disabled:bg-surface3 disabled:!text-text3"
          />
        )}
      </div>
    </div>
  )
}
