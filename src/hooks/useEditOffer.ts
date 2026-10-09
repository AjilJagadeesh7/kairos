import { useCallback, useState, type MutableRefObject } from 'react'
import { editNote } from '../ai/agent/noteAgent'
import { isAffirmative } from '../ai/agent/editOffer'
import type { BubbleMessage, BubbleRun } from '../types'

interface Deps {
  messagesRef: MutableRefObject<BubbleMessage[]>
  patch: (id: string, update: (m: BubbleMessage) => BubbleMessage) => void
  run: BubbleRun
  /** Read by the env when an action runs. */
  allowedRef: MutableRefObject<boolean>
}

/**
 * The permission layer's state for one bubble chat: edit offers the user can
 * allow once, allow for the rest of the chat, or decline. Allowing only lets
 * the model propose — the edit is previewed and still needs Accept.
 */
export function useEditOffer({ messagesRef, patch, run, allowedRef }: Deps) {
  const [allowed, setAllowedState] = useState(false)
  const setAllowed = useCallback((v: boolean) => { allowedRef.current = v; setAllowedState(v) }, [allowedRef])

  /** `echo` is the user's typed reply ("yes"), shown as their turn. */
  const grant = useCallback((id: string, always: boolean, echo: string | null = null) => {
    const offer = messagesRef.current.find((m) => m.id === id)?.editOffer
    if (!offer || offer.state !== 'pending') return
    if (always) setAllowed(true)
    patch(id, (m) => ({ ...m, editOffer: { ...offer, state: 'granted' } }))
    void run(echo, (env) => editNote(env, offer.instruction, offer.target))
  }, [messagesRef, patch, run, setAllowed])

  const decline = useCallback((id: string) => {
    patch(id, (m) => (m.editOffer?.state === 'pending' ? { ...m, editOffer: { ...m.editOffer, state: 'declined' } } : m))
  }, [patch])

  /** A typed "yes" to the latest reply's offer allows it. True when it was handled. */
  const replyByText = useCallback((text: string): boolean => {
    const last = [...messagesRef.current].reverse().find((m) => m.role === 'assistant')
    if (last?.editOffer?.state !== 'pending' || !isAffirmative(text)) return false
    grant(last.id, false, text)
    return true
  }, [grant, messagesRef])

  return { allowed, setAllowed, grant, decline, replyByText }
}
