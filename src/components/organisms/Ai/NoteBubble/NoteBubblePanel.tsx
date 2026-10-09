import { useCallback, useMemo, useState, type MutableRefObject } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { BubblePanelShell } from '../Bubble/BubblePanelShell'
import { BubbleMessageView } from './BubbleMessageView'
import { PromptMenuPanel, PromptMenuToggle, PromptStarters } from './PromptMenu'
import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { useNoteBubble } from '../../../../hooks/useNoteBubble'
import { createNoteEditorBridge } from '../../Editor/aiEditorBridge'
import { runExtractTasks } from '../../../../ai/agent/noteTasks'
import { runSuggestTags, runSuggestTitle, runSummarize } from '../../../../ai/agent/noteActions'
import { askNote, editNote, runNoteInstruction } from '../../../../ai/agent/noteAgent'
import { runInsert } from '../../../../ai/agent/noteEdit'
import type { NotePreset } from './notePresets'
import type { BubbleEnv, BubblePrompt, NoteSnapshot } from '../../../../types'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /** A preset runs directly — no decision step. Edits apply to the selection, or the whole note. */
  function runPreset(p: NotePreset) {
    const r = p.run
    const job = (env: BubbleEnv): Promise<void> => {
      switch (r.kind) {
        case 'summary': return runSummarize(env)
        case 'title': return runSuggestTitle(env)
        case 'tags': return runSuggestTags(env)
        case 'tasks': return runExtractTasks(env)
        case 'edit': return editNote(env, r.instruction)
        case 'insert': return runInsert(env, r.instruction, r.at)
        case 'ask': {
          const sel = env.bridge.selection()
          return askNote(env, sel ? `${r.prompt}\n\nAbout this part of the note:\n"""\n${sel.markdown}\n"""` : r.prompt)
        }
      }
    }
    void bubble.run(p.label, job)
  }

  const runPrompt = (p: BubblePrompt) => void bubble.run(p.label, (env) => runNoteInstruction(env, p.instruction))

  // A typed "yes" answers the edit offer above it; anything else is a new instruction.
  const send = (text: string) => {
    if (!bubble.offer.replyByText(text)) void bubble.run(text, (env) => runNoteInstruction(env, text))
  }

  return (
    <BubblePanelShell
      title="Ask AI · this note"
      ariaLabel="AI assistant for this note"
      placeholder="Ask anything, or say what to change…"
      intro="Ask about this note or tell me what to change — e.g. “turn the budget into a table”. Changes are previewed in the note and need your Accept. Select text first to work on just that part."
      config={bubble.config}
      messages={bubble.messages}
      busy={bubble.busy}
      progress={bubble.progress}
      attached={bubble.attached}
      onAttach={bubble.setAttached}
      renderMessage={(m, openSettings) => (
        <BubbleMessageView
          key={m.id} message={m} busy={bubble.busy} handlers={bubble} taskHandlers={bubble.tasks} offerHandlers={bubble.offer}
          onSwitchProvider={openSettings}
        />
      )}
      starters={<PromptStarters disabled={bubble.busy} onPreset={runPreset} onMore={() => setMenuOpen(true)} />}
      tools={<PromptMenuToggle open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} />}
      overlay={menuOpen && <PromptMenuPanel disabled={bubble.busy} onPreset={runPreset} onPrompt={runPrompt} onClose={closeMenu} />}
      banner={bubble.offer.allowed && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-text3">
          <Icon name="shield-check" size={12} /> Edits allowed in this chat — each still needs your Accept.
          <Button variant="link" size="xs" className="!h-auto !px-0" onClick={() => bubble.offer.setAllowed(false)}>Ask each time</Button>
        </p>
      )}
      saveNow={bubble.saveNow}
      onSend={send}
      onStop={bubble.stop}
      onClear={bubble.clear}
      onClose={onClose}
    />
  )
}
