import { create } from 'zustand'
import type { JournalEntry } from '../types'
import { useLoaderStore } from './useLoaderStore'

type JournalState = {
  entries: Record<string, JournalEntry>   // keyed by YYYY-MM-DD
  activeDate: string | null
  isLoaded: boolean

  loadEntries: () => Promise<void>
  setActiveDate: (date: string | null) => void
  saveEntry: (date: string, content: string) => Promise<void>
  setEntryNoSync: (date: string, value: boolean) => Promise<void>
  deleteEntry: (date: string) => Promise<void>
}

export const useJournalStore = create<JournalState>()((set, _get) => ({
  entries: {},
  activeDate: null,
  isLoaded: false,

  loadEntries: async () => {
    const { readAllJournalEntries, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (!isPlainFolderConnected()) {
      set({ isLoaded: true })
      return
    }
    await useLoaderStore.getState().run('load-journal', async () => {
      try {
        const list = await readAllJournalEntries()
        const map: Record<string, JournalEntry> = {}
        for (const e of list) map[e.date] = e
        set({ entries: map, isLoaded: true })
      } catch (err) {
        console.warn('[loadEntries] failed:', err)
        set({ isLoaded: true })
      }
    })
  },

  setActiveDate: (activeDate) => set({ activeDate }),

  saveEntry: async (date, content) => {
    const now = new Date().toISOString()
    const entry: JournalEntry = { date, content, updatedAt: now }

    set(s => ({ entries: { ...s.entries, [date]: entry } }))

    const { writeJournalEntry, appendJournalVersion, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) {
      writeJournalEntry(entry).catch(err => console.warn('[journal] write failed:', err))
      appendJournalVersion(date, { savedAt: now, content })
        .catch(err => console.warn('[history] journal append failed:', err))
    }
    const { schedulePush } = await import('../sync/debouncedCloudPush')
    schedulePush('journal', date, entry)
  },

  setEntryNoSync: async (date, value) => {
    const existing = useJournalStore.getState().entries[date]
    if (!existing) return
    const entry: JournalEntry = { ...existing, noSync: value || undefined, updatedAt: new Date().toISOString() }
    set(s => ({ entries: { ...s.entries, [date]: entry } }))

    const { writeJournalEntry, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) {
      writeJournalEntry(entry).catch(err => console.warn('[journal] write failed:', err))
    }
    // Push immediately so opting out deletes the cloud copy right away.
    const { pushContentToAll } = await import('../sync/syncOrchestrator')
    void pushContentToAll('journal', entry)
  },

  deleteEntry: async (date) => {
    set(s => {
      const { [date]: _, ...rest } = s.entries
      return { entries: rest, activeDate: s.activeDate === date ? null : s.activeDate }
    })

    const { deleteJournalEntryFile, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) {
      deleteJournalEntryFile(date).catch(() => { /* best-effort */ })
    }
    const { pushDelete } = await import('../sync/debouncedCloudPush')
    pushDelete('journal', date, `${date}.md`)
  },
}))

/** Returns today's date as YYYY-MM-DD in local time. */
export function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
