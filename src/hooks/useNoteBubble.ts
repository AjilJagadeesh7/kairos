import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useBubbleSession } from './useBubbleSession'
import { useBubbleSuggestions } from './useBubbleSuggestions'
import { useEditOffer } from './useEditOffer'
import { useTaskPlan } from './useTaskPlan'
import type { BubbleBaseEnv, BubbleEnv, UseNoteBubbleParams } from '../types'

/**
 * One ephemeral bubble session on a note. Every mount starts empty; closing
 * (unmount) or clearing saves the conversation to chat history.
 */
export function useNoteBubble(params: UseNoteBubbleParams) {
  const paramsRef = useRef(params)
  useEffect(() => { paramsRef.current = params }, [params])
  // "Always allow" edits for this chat (useEditOffer sets it).
  const editsAllowedRef = useRef(false)

  const session = useBubbleSession<BubbleEnv>(useMemo(() => ({
    source: () => {
      const note = paramsRef.current.note()
      return { kind: 'note' as const, id: note.id, title: note.title }
    },
    extendEnv: (base: BubbleBaseEnv): BubbleEnv => ({
      ...base,
      note: paramsRef.current.note,
      vocabulary: paramsRef.current.vocabulary(),
      bridge: paramsRef.current.bridge,
      editsAllowed: () => editsAllowedRef.current,
    }),
    // A new action replaces any suggestion still waiting in the editor.
    beforeRun: ({ messages, patch }) => {
      paramsRef.current.bridge.clearPreview()
      for (const m of messages) {
        const s = m.suggestion
        if ((s?.kind === 'replace' || s?.kind === 'insert') && s.state === 'pending') {
          patch(m.id, (x) => ({ ...x, suggestion: { ...s, state: 'rejected' } }))
        }
      }
    },
    onEnd: () => paramsRef.current.bridge.clearPreview(),
  }), []))

  const suggestions = useBubbleSuggestions({
    paramsRef, messagesRef: session.messagesRef, add: session.add, patch: session.patch, run: session.run,
  })

  const tasks = useTaskPlan({ messagesRef: session.messagesRef, add: session.add, patch: session.patch })

  const offer = useEditOffer({ messagesRef: session.messagesRef, patch: session.patch, run: session.run, allowedRef: editsAllowedRef })

  // Permission lasts for one chat: a new chat starts asking again.
  const { clear: clearSession } = session
  const { setAllowed } = offer
  const clear = useCallback(() => { setAllowed(false); clearSession() }, [clearSession, setAllowed])

  return { ...session, ...suggestions, clear, tasks, offer }
}
