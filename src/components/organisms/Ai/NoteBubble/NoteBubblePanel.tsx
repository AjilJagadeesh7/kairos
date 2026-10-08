import { useMemo, type MutableRefObject } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { BubblePanelShell } from '../Bubble/BubblePanelShell'
import { BubbleMessageView } from './BubbleMessageView'
import { BubbleQuickActions } from './BubbleQuickActions'
import { useNoteBubble } from '../../../../hooks/useNoteBubble'
import { createNoteEditorBridge } from '../../Editor/aiEditorBridge'
import { notice } from '../../../../ai/agent/bubbleEnv'
import { runContinue, runRewrite } from '../../../../ai/agent/noteWriting'
import { runExtractTasks } from '../../../../ai/agent/noteTasks'
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

  function rewrite(style: RewriteStyle) {
    const selection = bridge.selection()
    void bubble.run(REWRITE_STYLES[style].label, async (env) => {
      if (selection) await runRewrite(env, style, selection)
      else notice(env, 'Select some text in the note first, then pick a rewrite style.')
    })
  }

  return (
    <BubblePanelShell
      title="Ask AI · this note"
      ariaLabel="AI assistant for this note"
      placeholder="Ask about this note…"
      intro="Works on this note only. Every change is previewed in the note and needs your Accept."
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
        <BubbleQuickActions
          disabled={bubble.busy}
          onSummarize={() => void bubble.run('Summarize this note', runSummarize)}
          onContinue={() => void bubble.run('Continue writing', (env) => runContinue(env))}
          onTitle={() => void bubble.run('Suggest a title', runSuggestTitle)}
          onTags={() => void bubble.run('Suggest tags', runSuggestTags)}
          onTasks={() => void bubble.run('Turn this into tasks', runExtractTasks)}
          onRewrite={rewrite}
        />
      }
      onSend={(text) => void bubble.run(text, (env) => runMessage(env, text))}
      onStop={bubble.stop}
      onClear={bubble.clear}
      onClose={onClose}
    />
  )
}
