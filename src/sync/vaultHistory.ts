/** Version history — `vault/history/notes/{id}.json` and `vault/history/journal/{date}.json`. */
import { getHistoryPolicy } from '../tiers/checks'
import { pruneVersions } from '../tiers/versionPrune'
import {
  isPlainFolderConnected, readVaultText, removeVaultFile, vaultDirBytes, writeVaultText,
} from './vaultFs'
import type { ContentVersion } from '../types'

type HistorySub = 'notes' | 'journal'

function historyPath(sub: HistorySub, id: string): string {
  return `history/${sub}/${id}.json`
}

async function readHistory(sub: HistorySub, id: string): Promise<ContentVersion[]> {
  try {
    const raw = await readVaultText(historyPath(sub, id))
    if (!raw) return []
    return (JSON.parse(raw) as { versions: ContentVersion[] }).versions ?? []
  } catch {
    return []
  }
}

/** Append a snapshot, then apply the active tier's version-history policy. */
async function appendVersion(sub: HistorySub, id: string, version: ContentVersion): Promise<void> {
  if (!isPlainFolderConnected()) return
  const existing = await readHistory(sub, id)
  const updated  = pruneVersions([...existing, version], getHistoryPolicy())
  await writeVaultText(historyPath(sub, id), JSON.stringify({ versions: updated }))
}

export function appendNoteVersion(noteId: string, version: ContentVersion): Promise<void> {
  return appendVersion('notes', noteId, version)
}

export function readNoteHistory(noteId: string): Promise<ContentVersion[]> {
  return readHistory('notes', noteId)
}

export function deleteNoteHistory(noteId: string): Promise<void> {
  return removeVaultFile(historyPath('notes', noteId))
}

export function appendJournalVersion(date: string, version: ContentVersion): Promise<void> {
  return appendVersion('journal', date, version)
}

export function readJournalHistory(date: string): Promise<ContentVersion[]> {
  return readHistory('journal', date)
}

/** Total bytes used by all version-history files (notes + journal). */
export async function historyTotalBytes(): Promise<number> {
  if (!isPlainFolderConnected()) return 0
  const isJson = (name: string) => name.endsWith('.json')
  try {
    const [notes, journal] = await Promise.all([
      vaultDirBytes('history/notes', isJson),
      vaultDirBytes('history/journal', isJson),
    ])
    return notes + journal
  } catch {
    return 0
  }
}
