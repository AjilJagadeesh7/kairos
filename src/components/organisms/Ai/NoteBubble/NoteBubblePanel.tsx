import { useMemo, type MutableRefObject } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { BubblePanelShell } from '../Bubble/BubblePanelShell'
import { BubbleMessageView } from './BubbleMessageView'
import { PromptMenu } from './PromptMenu'
import { useNoteBubble } from '../../../../hooks/useNoteBubble'
import { createNoteEditorBridge } from '../../Editor/aiEditorBridge'
import { runExtractTasks } from '../../../../ai/agent/noteTasks'
import { runQuestion, runSuggestTags, runSuggestTitle, runSummarize } from '../../../../ai/agent/noteActions'
import { editNote, runNoteInstruction } from '../../../../ai/agent/noteAgent'
import { runInsert } from '../../../../ai/agent/noteEdit'
import type { NotePreset } from './notePresets'
import type { BubbleEnv, NoteSnapshot } from '../../../../types'

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
          return runQuestion(env, sel ? `${r.prompt}\n\nAbout this part of the note:\n"""\n${sel.markdown}\n"""` : r.prompt)
        }
      }
    }
    void bubble.run(p.label, job)
  }

  return (
    <BubblePanelShell
      title="Ask AI · this note"
      ariaLabel="AI assistant for this note"
      placeholder="Ask or tell me anything about this note — e.g. “turn the budget into a table”"
      intro="Works on this note only. Ask questions, or ask for any change — it's previewed in the note and needs your Accept. Select text first to work on just that part."
      config={bubble.config}
      messages={bubble.messages}
      busy={bubble.busy}
      progress={bubble.progress}
      attached={bubble.attached}
      onAttach={bubble.setAttached}
      renderMessage={(m, openSettings) => (
        <BubbleMessageView key={m.id} message={m} busy={bubble.busy} handlers={bubble} taskHandlers={bubble.tasks} onSwitchProvider={openSettings} />
      )}
      quickActions={
        <PromptMenu
          disabled={bubble.busy}
          onPreset={runPreset}
          onPrompt={(p) => void bubble.run(p.label, (env) => runNoteInstruction(env, p.instruction))}
        />
      }
      onSend={(text) => void bubble.run(text, (env) => runNoteInstruction(env, text))}
      onStop={bubble.stop}
      onClear={bubble.clear}
      onClose={onClose}
    />
  )
}
