/**
 * Chat history in IndexedDB, with the retention setting (PRD: keep / 30 days
 * / never). "Never" means nothing is written and anything saved earlier is
 * removed. Chat history is AI data derived from the user's own messages, not
 * vault content, so it isn't routed through the trash — deleting a chat asks
 * for confirmation instead.
 */
import { db } from '../../db/schema'
import { useAiStore } from '../../store/useAiStore'
import type { AiChatRecord, ChatRetention } from '../../types'

const DAY_MS = 86_400_000

export async function saveChat(record: AiChatRecord): Promise<void> {
  if (useAiStore.getState().chatRetention === 'never') return
  await db.aiChats.put(record)
}

export function getChat(id: string): Promise<AiChatRecord | undefined> {
  return db.aiChats.get(id)
}

export function deleteChat(id: string): Promise<void> {
  return db.aiChats.delete(id)
}

export function clearChats(): Promise<void> {
  return db.aiChats.clear()
}

/** Chats the retention setting no longer allows. Returns how many were removed. */
export async function sweepChats(retention: ChatRetention, now = Date.now()): Promise<number> {
  if (retention === 'keep') return 0
  if (retention === 'never') {
    const n = await db.aiChats.count()
    await db.aiChats.clear()
    return n
  }
  const cutoff = new Date(now - 30 * DAY_MS).toISOString()
  return db.aiChats.where('updatedAt').below(cutoff).delete()
}
