/** Window event that opens the AI bubble on a page (sent by the command palette). */
export const AI_BUBBLE_EVENT = 'kairos:ai-bubble'

/** `pagePath` is the page's route without a query, e.g. `/notes/<id>` or `/kanban/<boardId>`. */
export function openAiBubble(pagePath: string): void {
  window.dispatchEvent(new CustomEvent<{ pagePath: string }>(AI_BUBBLE_EVENT, { detail: { pagePath } }))
}

/** The page route a bubble can open on, or null (task pages, lists, settings…). */
export function bubblePagePath(tabPath: string): string | null {
  const path = tabPath.split(/[?#]/)[0]
  return /^\/notes\/[^/]+$/.test(path) || /^\/kanban\/[^/]+$/.test(path) ? path : null
}
