import { create } from 'zustand'
import type { Note } from '../types'

export type Conflict = {
  noteId: string
  localNote: Note
  remoteNote: Note
  detectedAt: string
}

type ConflictState = {
  conflicts: Conflict[]
  addConflict: (c: Conflict) => void
  resolveConflict: (noteId: string) => void
}

export const useConflictStore = create<ConflictState>((set) => ({
  conflicts: [],
  addConflict: (c) => set(s => ({
    conflicts: [...s.conflicts.filter(x => x.noteId !== c.noteId), c],
  })),
  resolveConflict: (noteId) => set(s => ({
    conflicts: s.conflicts.filter(c => c.noteId !== noteId),
  })),
}))
