/** Notes (`vault/notes/*.md`) and journal entries (`vault/journal/YYYY-MM-DD.md`). */
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import {
  isPlainFolderConnected, listVaultDir, readVaultText, removeVaultFile, writeVaultText,
} from './vaultFs'
import type { JournalEntry, Note } from '../types'

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function writePlainNote(note: Note): Promise<void> {
  const { suppressVaultWatcher } = await import('./selfWriteGuard')
  suppressVaultWatcher()
  await writeVaultText(`notes/${noteIdToPath(note.id)}`, serializeNote(note))
}

export async function deletePlainNote(noteId: string): Promise<void> {
  await removeVaultFile(`notes/${noteIdToPath(noteId)}`)
}

export async function readAllNotes(): Promise<Note[]> {
  if (!isPlainFolderConnected()) return []
  const names = (await listVaultDir('notes')).filter(n => n.endsWith('.md'))
  const results = await Promise.allSettled(
    names.map(async name => {
      const raw = await readVaultText(`notes/${name}`)
      if (raw === null) throw new Error('unreadable')
      return deserializeNote(raw)
    }),
  )
  return results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export function serializeJournalEntry(entry: JournalEntry): string {
  const fm = [`date: ${entry.date}`, `updatedAt: ${entry.updatedAt}`]
  if (entry.noSync) fm.push('noSync: true')
  return `---\n${fm.join('\n')}\n---\n\n${entry.content}`
}

export function deserializeJournalEntry(raw: string, fallbackDate: string): JournalEntry {
  if (raw.startsWith('---\n')) {
    const rest = raw.slice(4)
    const closeIdx = rest.indexOf('\n---\n')
    if (closeIdx !== -1) {
      const fm = rest.slice(0, closeIdx)
      const body = rest.slice(closeIdx + 5).replace(/^\n/, '')
      const get = (key: string) => fm.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1] ?? ''
      const entry: JournalEntry = {
        date: get('date') || fallbackDate,
        content: body,
        updatedAt: get('updatedAt') || new Date().toISOString(),
      }
      if (get('noSync') === 'true') entry.noSync = true
      return entry
    }
  }
  return { date: fallbackDate, content: raw, updatedAt: new Date().toISOString() }
}

export async function writeJournalEntry(entry: JournalEntry): Promise<void> {
  await writeVaultText(`journal/${entry.date}.md`, serializeJournalEntry(entry))
}

export async function deleteJournalEntryFile(date: string): Promise<void> {
  await removeVaultFile(`journal/${date}.md`)
}

export async function readAllJournalEntries(): Promise<JournalEntry[]> {
  if (!isPlainFolderConnected()) return []
  const names = (await listVaultDir('journal')).filter(n => n.endsWith('.md'))
  const entries: JournalEntry[] = []
  for (const name of names) {
    const raw = await readVaultText(`journal/${name}`)
    if (raw === null) continue
    try { entries.push(deserializeJournalEntry(raw, name.slice(0, -3))) } catch { /* skip malformed */ }
  }
  return entries
}
