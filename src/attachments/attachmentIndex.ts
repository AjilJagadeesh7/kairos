import { useSyncExternalStore } from 'react'
import { db } from '../db/schema'
import { ATTACHMENTS_CHANGED_EVENT } from './attachmentService'

/**
 * Lightweight per-owner attachment counts for the sidebar tree. Reads only the
 * `ownerId` index keys (never the blobs), so it stays cheap even with many large
 * attachments. Refreshed whenever the attachment set changes.
 */
let counts = new Map<string, number>()
let loaded = false
let loading = false
const listeners = new Set<() => void>()

async function refresh(): Promise<void> {
  if (loading) return
  loading = true
  try {
    const keys = (await db.attachments.orderBy('ownerId').keys()) as string[]
    const next = new Map<string, number>()
    for (const k of keys) next.set(k, (next.get(k) ?? 0) + 1)
    counts = next
    loaded = true
    listeners.forEach((l) => l())
  } finally {
    loading = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(ATTACHMENTS_CHANGED_EVENT, () => void refresh())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  if (!loaded) void refresh()
  return () => { listeners.delete(fn) }
}

/** Reactive attachment count for one owner (note id or journal date). */
export function useAttachmentCount(ownerId: string): number {
  return useSyncExternalStore(subscribe, () => counts.get(ownerId) ?? 0)
}
