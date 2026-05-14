import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { db, upsertNote, upsertEmbedding } from '../db/schema'
import { useLoaderStore } from './useLoaderStore'
import type { Note, SearchMode, SyncStatus, ThemeMode } from '../types'
import type { S3Config } from '../sync/s3'
import type { WebDAVConfig } from '../sync/webdav'
import { parseTags } from '../utils/wikilinks'

export type StorageTarget = 'indexdb' | 'local'

type AppState = {
  activeNoteId?: string
  query: string
  searchMode: SearchMode
  syncStatus: SyncStatus
  storageChoices: StorageTarget[]
  theme: ThemeMode
  aiUrl: string
  s3Config: S3Config | null
  webdavConfig: WebDAVConfig | null
  mobileSidebarOpen: boolean

  setTheme: (t: ThemeMode) => void
  setAiUrl: (url: string) => void
  setSearchMode: (mode: SearchMode) => void
  setQuery: (query: string) => void
  setSyncStatus: (status: SyncStatus) => void
  setS3Config: (cfg: S3Config | null) => void
  setWebDAVConfig: (cfg: WebDAVConfig | null) => void
  setActiveNoteId: (id?: string) => void
  setMobileSidebarOpen: (open: boolean) => void
  setStorageChoices: (choices: StorageTarget[]) => void
  createNote: () => Promise<string>
  updateActiveNote: (patch: Pick<Note, 'title' | 'content' | 'embedding'> & { contentHash: string }) => Promise<void>
  deleteNoteById: (id: string) => Promise<void>
}

function readLegacyStorageChoices(): StorageTarget[] {
  try {
    const raw = localStorage.getItem('mindvault_storage_choices')
    if (raw) return JSON.parse(raw) as StorageTarget[]
  } catch { /* ignore */ }
  const legacy = localStorage.getItem('mindvault_storage_choice')
  return legacy === 'local' ? ['indexdb', 'local'] : ['indexdb']
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      query: '',
      searchMode: 'fulltext',
      syncStatus: 'idle',
      s3Config: null,
      webdavConfig: null,
      mobileSidebarOpen: false,
      storageChoices: readLegacyStorageChoices(),
      theme: (localStorage.getItem('mindvault.theme') as ThemeMode | null) ?? 'light',
      aiUrl: 'http://localhost:11434',

      setTheme: (theme) => set({ theme }),
      setAiUrl: (aiUrl) => set({ aiUrl }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      setSearchMode: (searchMode) => set({ searchMode }),
      setQuery: (query) => set({ query }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setS3Config: (s3Config) => set({ s3Config }),
      setWebDAVConfig: (webdavConfig) => set({ webdavConfig }),
      setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
      setStorageChoices: (storageChoices) => set({ storageChoices }),

      createNote: async () => {
        const { run } = useLoaderStore.getState()
        return run('create-note', async () => {
          const now = new Date().toISOString()
          const id  = uuidv4()
          const note: Note = { id, title: 'Untitled note', content: '', tags: [], embedding: [], createdAt: now, updatedAt: now }
          await upsertNote(note)
          set({ activeNoteId: id })
          return id
        }, 'Creating note…')
      },

      updateActiveNote: async ({ title, content, embedding, contentHash }) => {
        const { activeNoteId } = get()
        if (!activeNoteId) return
        const existing = await db.notes.get(activeNoteId)
        if (!existing) return

        const updated: Note = {
          ...existing,
          title,
          content,
          embedding: [],
          tags: parseTags(content),
          updatedAt: new Date().toISOString(),
        }

        await upsertNote(updated)
        await upsertEmbedding(activeNoteId, embedding ?? [], contentHash)

        // Write to plain local folder storage if selected
        const { storageChoices } = get()
        if (storageChoices.includes('local')) {
          const { isPlainFolderConnected, writePlainNote } = await import('../sync/plainFolder')
          if (isPlainFolderConnected()) {
            writePlainNote(updated).catch((err) => console.warn('[storage] plain folder write failed:', err))
          }
        }

        // Background push to all connected sync providers
        const { setSyncStatus } = get()
        const { pushNoteToAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
        if (anySyncProviderConnected()) {
          setSyncStatus('syncing')
          pushNoteToAll(updated)
            .then(() => setSyncStatus('ok'))
            .catch((err) => { console.warn('[sync] push failed:', err); setSyncStatus('error') })
        }
      },

      deleteNoteById: async (id) => {
        const { run } = useLoaderStore.getState()
        await run('delete-note', async () => {
          const { storageChoices } = get()
          if (storageChoices.includes('local')) {
            const { isPlainFolderConnected, deletePlainNote } = await import('../sync/plainFolder')
            if (isPlainFolderConnected()) {
              await deletePlainNote(id).catch(() => { /* best-effort */ })
            }
          }

          const { deleteNoteFromAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
          if (anySyncProviderConnected()) await deleteNoteFromAll(id)

          await db.notes.delete(id)
          await db.syncMeta.delete(id)
          await db.embeddings.delete(id)
          const { activeNoteId } = get()
          if (activeNoteId === id) set({ activeNoteId: undefined })
        }, 'Deleting note…')
      },
    }),
    {
      name: 'mindvault-ui-store',
      partialize: (state) => ({
        activeNoteId:   state.activeNoteId,
        searchMode:     state.searchMode,
        s3Config:       state.s3Config,
        webdavConfig:   state.webdavConfig,
        storageChoices: state.storageChoices,
        theme:          state.theme,
        aiUrl:          state.aiUrl,
      }),
    },
  ),
)
