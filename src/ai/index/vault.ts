/**
 * The vault as the global chat reads it: notes, journal entries and boards
 * from the existing stores. Journal and boards load lazily elsewhere, so the
 * chat makes sure they're loaded before it counts anything.
 */
import { useAppStore } from '../../store/useAppStore'
import { useJournalStore } from '../../store/useJournalStore'
import { useKanbanStore } from '../../store/useKanbanStore'
import type { VaultSnapshot } from '../../types'

export async function ensureVaultLoaded(): Promise<void> {
  const loads: Promise<void>[] = []
  if (!useJournalStore.getState().isLoaded) loads.push(useJournalStore.getState().loadEntries())
  if (!useKanbanStore.getState().isLoaded) loads.push(useKanbanStore.getState().loadBoards())
  await Promise.all(loads)
}

export function vaultSnapshot(): VaultSnapshot {
  return {
    notes: useAppStore.getState().notes,
    journal: Object.values(useJournalStore.getState().entries),
    boards: useKanbanStore.getState().boards,
    folders: useAppStore.getState().folderList,
  }
}
