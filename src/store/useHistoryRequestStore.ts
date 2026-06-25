import { create } from 'zustand'

interface HistoryRequestState {
  /** Note id whose version history should open once its editor mounts, or null. */
  requestedNoteId: string | null
  request: (noteId: string) => void
  clear: () => void
}

/**
 * Bridges "View History" in the note context menu (sidebar) to the editor's
 * HistoryPanel, which lives inside EditorDraft. The menu navigates to the note
 * and sets the request; the editor consumes it on mount and clears it.
 */
export const useHistoryRequestStore = create<HistoryRequestState>((set) => ({
  requestedNoteId: null,
  request: (noteId) => set({ requestedNoteId: noteId }),
  clear: () => set({ requestedNoteId: null }),
}))
