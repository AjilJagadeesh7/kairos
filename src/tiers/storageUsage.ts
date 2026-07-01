import { db, getAllBoards, getAllJournalEntries, getAllCanvases, getAllAttachments } from '../db/schema'
import { serializeNote } from '../adapters/storage/noteSerializer'
import { historyTotalBytes } from '../sync/plainFolder'
import { byteLength } from './checks'
import type { StorageUsage } from '../types'

// Matches the base64 payload of an embedded data URL. The stored cost is the
// base64 string itself (that's what lives in the .md/.json on disk).
const DATA_URL_RE = /data:[^;,\s]*;base64,([A-Za-z0-9+/=]+)/g

function base64Bytes(str: string): number {
  let total = 0
  for (const m of str.matchAll(DATA_URL_RE)) total += m[1].length
  return total
}

/**
 * Compute current storage usage, split into notes / attachments / versions.
 * "Notes" is all serialized text (notes, journal, boards, canvases) minus the
 * embedded base64, which is counted under "attachments". Heavy-ish (reads all
 * content) — call on app start, after sync, and on a 5-min interval; cache the result.
 */
export async function computeStorageUsage(): Promise<StorageUsage> {
  let textBytes = 0
  let attachmentBytes = 0

  const notes = await db.notes.toArray()
  for (const n of notes) {
    const ser = serializeNote(n)
    const att = base64Bytes(ser)
    attachmentBytes += att
    textBytes += byteLength(ser) - att
  }

  for (const collection of [await getAllBoards(), await getAllJournalEntries(), await getAllCanvases()]) {
    for (const item of collection) {
      const json = JSON.stringify(item)
      const att = base64Bytes(json)
      attachmentBytes += att
      textBytes += byteLength(json) - att
    }
  }

  // File-based attachments (images/video/audio/pdf stored as blobs).
  for (const att of await getAllAttachments()) attachmentBytes += att.size

  const versions = await historyTotalBytes()
  const total = textBytes + attachmentBytes + versions

  return {
    sync: { notes: Math.max(0, textBytes), attachments: attachmentBytes, versions, total },
    publish: { total: await reportPublishUsage() },
  }
}

/**
 * Published-site storage usage. There is no hosted publish backend yet, so this
 * is the single seam a future backend reports through — returns 0 today.
 */
export async function reportPublishUsage(): Promise<number> {
  return 0
}
