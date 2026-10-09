import { useCallback, type MutableRefObject } from 'react'
import { newMessage } from '../ai/agent/bubbleEnv'
import { runContinue, runRewrite } from '../ai/agent/noteWriting'
import { runEdit, runInsert } from '../ai/agent/noteEdit'
import { summaryCallout } from '../ai/agent/noteActions'
import type { BubbleMessage, BubbleRun, BubbleSuggestion, UseNoteBubbleParams } from '../types'

interface Deps {
  paramsRef: MutableRefObject<UseNoteBubbleParams>
  messagesRef: MutableRefObject<BubbleMessage[]>
  add: (m: BubbleMessage) => void
  patch: (id: string, update: (m: BubbleMessage) => BubbleMessage) => void
  run: BubbleRun
}

/**
 * What the user can do with a suggestion. These are the only paths that
 * write to the note, and each one is an explicit click.
 */
export function useBubbleSuggestions({ paramsRef, messagesRef, add, patch, run }: Deps) {
  const find = useCallback((id: string) => messagesRef.current.find((m) => m.id === id), [messagesRef])

  const setSuggestion = useCallback((id: string, update: (s: BubbleSuggestion) => BubbleSuggestion) =>
    patch(id, (m) => (m.suggestion ? { ...m, suggestion: update(m.suggestion) } : m)), [patch])

  const accept = useCallback((id: string) => {
    const s = find(id)?.suggestion
    if ((s?.kind !== 'replace' && s?.kind !== 'insert') || s.state !== 'pending') return
    const result = paramsRef.current.bridge.applyPreview(s.proposed)
    if (result === 'ok') {
      setSuggestion(id, (x) => ({ ...x, state: 'accepted' }) as BubbleSuggestion)
      return
    }
    paramsRef.current.bridge.clearPreview()
    setSuggestion(id, (x) => ({ ...x, state: 'stale' }) as BubbleSuggestion)
    add(newMessage({
      role: 'notice',
      content: result === 'changed'
        ? 'That text was edited after the suggestion was made, so it was not applied. Retry to get a fresh suggestion.'
        : 'The suggestion is no longer showing in the note, so it was not applied.',
    }))
  }, [add, find, paramsRef, setSuggestion])

  const reject = useCallback((id: string) => {
    paramsRef.current.bridge.clearPreview()
    setSuggestion(id, (x) => ({ ...x, state: 'rejected' }) as BubbleSuggestion)
  }, [paramsRef, setSuggestion])

  const retry = useCallback((id: string) => {
    const s = find(id)?.suggestion
    const bridge = paramsRef.current.bridge
    if (s?.kind === 'replace') {
      // Same range if the preview is still up; otherwise whatever is selected now.
      const range = s.state === 'pending' ? bridge.previewRange() : null
      const target = range
        ? { ...range, markdown: s.original, text: s.originalText }
        : bridge.selection()
      if (!target) {
        add(newMessage({ role: 'notice', content: 'Select the text to rewrite again, then press Retry.' }))
        return
      }
      const { instruction, style } = s
      void run(null, (env) => (instruction ? runEdit(env, instruction, target, true) : runRewrite(env, style ?? 'shorter', target, true)))
    } else if (s?.kind === 'insert') {
      const pos = (s.state === 'pending' ? bridge.previewRange()?.from : undefined) ?? s.pos
      const { instruction } = s
      void run(null, (env) => (instruction ? runInsert(env, instruction, 'cursor', pos) : runContinue(env, pos)))
    }
  }, [add, find, paramsRef, run])

  const insertSummary = useCallback((id: string) => {
    const m = find(id)
    if (m?.suggestion?.kind !== 'summary' || m.suggestion.inserted) return
    if (paramsRef.current.bridge.insertAtTop(summaryCallout(m.content))) {
      setSuggestion(id, () => ({ kind: 'summary', inserted: true }))
    }
  }, [find, paramsRef, setSuggestion])

  const applyTitle = useCallback((id: string, title: string) => {
    paramsRef.current.onApplyTitle(title)
    setSuggestion(id, (x) => (x.kind === 'title' ? { ...x, applied: title } : x))
  }, [paramsRef, setSuggestion])

  const applyTags = useCallback((id: string, tags: string[]) => {
    if (!tags.length) return
    const current = paramsRef.current.note().tags
    paramsRef.current.onApplyTags([...current, ...tags.filter((t) => !current.includes(t))])
    setSuggestion(id, (x) => (x.kind === 'tags' ? { ...x, applied: tags } : x))
  }, [paramsRef, setSuggestion])

  return { accept, reject, retry, insertSummary, applyTitle, applyTags }
}
