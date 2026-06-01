/**
 * Debounced cloud push for kanban/canvas/journal. Rapid edits (card drags,
 * keystrokes) collapse into a single PUT per item once activity quiets down.
 * Notes are NOT routed through here — they push immediately on save.
 */
import type { ContentCategory } from './categoryRegistry'

const DEBOUNCE_MS = 1500
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function key(category: ContentCategory, id: string): string {
  return `${category}:${id}`
}

/**
 * Schedule a cloud push for `item`. Repeated calls for the same id reset the
 * timer; the push that finally fires uses the most recently passed item.
 */
export function schedulePush(category: ContentCategory, id: string, item: unknown): void {
  const k = key(category, id)
  const existing = timers.get(k)
  if (existing) clearTimeout(existing)
  timers.set(k, setTimeout(() => {
    timers.delete(k)
    void import('./syncOrchestrator').then(({ pushContentToAll }) =>
      pushContentToAll(category, item).catch((e) => console.warn(`[sync] ${category} push failed:`, e)))
  }, DEBOUNCE_MS))
}

/** Cancel any pending push and delete the item from all remotes immediately. */
export function pushDelete(category: ContentCategory, id: string, filename: string): void {
  const k = key(category, id)
  const existing = timers.get(k)
  if (existing) { clearTimeout(existing); timers.delete(k) }
  void import('./syncOrchestrator').then(({ deleteContentFromAll }) =>
    deleteContentFromAll(category, id, filename).catch((e) => console.warn(`[sync] ${category} delete failed:`, e)))
}
