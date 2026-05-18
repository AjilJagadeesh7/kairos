import { create } from 'zustand'
import type { DailyNote } from '../types'

type DailyNotesState = {
  dailyNotes: Record<string, DailyNote>   // keyed by YYYY-MM-DD
  activeDailyDate: string | null
  isLoaded: boolean

  loadDailyNotes: () => Promise<void>
  setActiveDailyDate: (date: string | null) => void
  saveDailyNote: (date: string, content: string) => Promise<void>
  deleteDailyNote: (date: string) => Promise<void>
}

export const useDailyNotesStore = create<DailyNotesState>()((set, get) => ({
  dailyNotes: {},
  activeDailyDate: null,
  isLoaded: false,

  loadDailyNotes: async () => {
    const { readAllDailyNotes, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (!isPlainFolderConnected()) {
      set({ isLoaded: true })
      return
    }
    try {
      const notes = await readAllDailyNotes()
      const map: Record<string, DailyNote> = {}
      for (const n of notes) map[n.date] = n
      set({ dailyNotes: map, isLoaded: true })
    } catch (err) {
      console.warn('[loadDailyNotes] failed:', err)
      set({ isLoaded: true })
    }
  },

  setActiveDailyDate: (activeDailyDate) => set({ activeDailyDate }),

  saveDailyNote: async (date, content) => {
    const now = new Date().toISOString()
    const note: DailyNote = { date, content, updatedAt: now }

    set(s => ({ dailyNotes: { ...s.dailyNotes, [date]: note } }))

    const { writeDailyNote, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) {
      writeDailyNote(note).catch(err => console.warn('[daily] write failed:', err))
    }
  },

  deleteDailyNote: async (date) => {
    set(s => {
      const { [date]: _, ...rest } = s.dailyNotes
      return { dailyNotes: rest, activeDailyDate: s.activeDailyDate === date ? null : s.activeDailyDate }
    })

    const { deleteDailyNoteFile, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) {
      deleteDailyNoteFile(date).catch(() => { /* best-effort */ })
    }
  },
}))

/** Returns today's date as YYYY-MM-DD in local time. */
export function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
