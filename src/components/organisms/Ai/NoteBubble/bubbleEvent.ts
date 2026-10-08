/** Window event that opens the AI bubble on a note (sent by the command palette). */
export const AI_BUBBLE_EVENT = 'kairos:ai-bubble'

export function openAiBubble(noteId: string): void {
  window.dispatchEvent(new CustomEvent<{ noteId: string }>(AI_BUBBLE_EVENT, { detail: { noteId } }))
}
