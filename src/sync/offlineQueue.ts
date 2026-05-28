/**
 * Persists a set of noteIds that failed to sync (e.g. while offline).
 * Drained automatically when the device comes back online.
 * Uses localStorage so it survives app restarts without a DB migration.
 */

const KEY = 'kairos_offline_queue'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set()
}

function persist(q: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...q]))
  } catch { /* ignore */ }
}

export function enqueue(noteId: string): void {
  const q = load()
  q.add(noteId)
  persist(q)
}

export function dequeue(noteId: string): void {
  const q = load()
  q.delete(noteId)
  persist(q)
}

export function getPending(): string[] {
  return [...load()]
}

export function clearQueue(): void {
  localStorage.removeItem(KEY)
}
