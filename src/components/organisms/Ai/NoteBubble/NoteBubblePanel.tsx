import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Crepe } from '@milkdown/crepe'
import { Button } from '../../../atoms/Button'
import { IconButton } from '../../../atoms/IconButton'
import { LocationBadge } from '../../../atoms/LocationBadge'
import { EmptyState } from '../../../molecules/EmptyState'
import { BubbleMessageView } from './BubbleMessageView'
import { BubbleQuickActions } from './BubbleQuickActions'
import { useNoteBubble } from '../../../../hooks/useNoteBubble'
import { createNoteEditorBridge } from '../../Editor/aiEditorBridge'
import { destinationLabel, locationForUrl } from '../../../../ai/net/urlPolicy'
import { notice } from '../../../../ai/agent/bubbleEnv'
import { runContinue, runRewrite } from '../../../../ai/agent/noteWriting'
import { runMessage, runSuggestTags, runSuggestTitle, runSummarize } from '../../../../ai/agent/noteActions'
import { REWRITE_STYLES } from '../../../../ai/prompts/noteBubble.v1'
import type { NoteSnapshot, RewriteStyle } from '../../../../types'

interface NoteBubblePanelProps {
  getNote: () => NoteSnapshot
  editorRef: MutableRefObject<Crepe | null>
  vocabulary: () => string[]
  onApplyTitle: (title: string) => void
  onApplyTags: (tags: string[]) => void
  onClose: () => void
}

/** The page bubble's chat panel for one note. Loaded only when opened. */
export default function NoteBubblePanel({ getNote, editorRef, vocabulary, onApplyTitle, onApplyTags, onClose }: NoteBubblePanelProps) {
  const navigate = useNavigate()
  const bridge = useMemo(() => createNoteEditorBridge(editorRef), [editorRef])
  const params = useMemo(() => ({
    // The editor's live markdown: the draft copy updates on a debounce.
    note: () => {
      const note = getNote()
      return { ...note, content: bridge.markdown() ?? note.content }
    },
    bridge, vocabulary, onApplyTitle, onApplyTags,
  }), [getNote, bridge, vocabulary, onApplyTitle, onApplyTags])
  const bubble = useNoteBubble(params)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [bubble.messages, bubble.progress])

  const openSettings = () => navigate('/settings?section=ai')

  function rewrite(style: RewriteStyle) {
    const selection = bridge.selection()
    void bubble.run(REWRITE_STYLES[style].label, async (env) => {
      if (selection) await runRewrite(env, style, selection)
      else notice(env, 'Select some text in the note first, then pick a rewrite style.')
    })
  }

  function send() {
    const text = draft.trim()
    if (!text || bubble.busy) return
    setDraft('')
    void bubble.run(text, (env) => runMessage(env, text))
  }

  const location = bubble.config ? locationForUrl(bubble.config.baseUrl) : null

  return (
    <div
      role="dialog"
      aria-label="AI assistant for this note"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
      className="fixed inset-x-0 bottom-0 z-[55] flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-2xl
        md:absolute md:inset-x-auto md:bottom-4 md:right-4 md:max-h-[min(640px,calc(100%-2rem))] md:w-[400px] md:rounded-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text">Ask AI · this note</p>
          {bubble.config && location && (
            <p className="flex items-center gap-1.5 truncate text-[11px] text-text3">
              <LocationBadge location={location} />
              <span className="truncate">{destinationLabel(location, bubble.config.name)}</span>
            </p>
          )}
        </div>
        <IconButton icon="eraser" label="Clear conversation" size="sm" disabled={!bubble.messages.length} onClick={bubble.clear} />
        <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
      </header>

      {!bubble.config ? (
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
            {!bubble.messages.length && (
              <p className="text-[12px] text-text3">
                Works on this note only. Every change is previewed in the note and needs your Accept.
              </p>
            )}
            {bubble.messages.map((m) => (
              <BubbleMessageView key={m.id} message={m} busy={bubble.busy} handlers={bubble} onSwitchProvider={openSettings} />
            ))}
            {bubble.progress && <p className="text-[11px] text-text3">{bubble.progress}</p>}
            <div ref={endRef} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
            <BubbleQuickActions
              disabled={bubble.busy}
              onSummarize={() => void bubble.run('Summarize this note', runSummarize)}
              onContinue={() => void bubble.run('Continue writing', (env) => runContinue(env))}
              onTitle={() => void bubble.run('Suggest a title', runSuggestTitle)}
              onTags={() => void bubble.run('Suggest tags', runSuggestTags)}
              onRewrite={rewrite}
            />
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={1}
                placeholder="Ask about this note…"
                className="max-h-28 min-h-[34px] flex-1 resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text outline-none placeholder:text-text3 focus:border-accent"
              />
              {bubble.busy
                ? <Button variant="hollow" size="md" onClick={bubble.stop}>Stop</Button>
                : <Button variant="primary" size="md" disabled={!draft.trim()} onClick={send}>Send</Button>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
