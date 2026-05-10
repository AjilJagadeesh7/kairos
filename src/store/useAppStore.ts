import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { db, upsertNote, upsertEmbedding } from '../db/schema'
import { useLoaderStore } from './useLoaderStore'
import type { Note, SearchMode, SyncProviderType, SyncStatus } from '../types'
import type { S3Config } from '../sync/s3'
import type { WebDAVConfig } from '../sync/webdav'
import { parseTags } from '../utils/wikilinks'

type AppState = {
  activeNoteId?: string
  query: string
  searchMode: SearchMode
  syncStatus: SyncStatus
  syncProvider: SyncProviderType
  s3Config: S3Config | null
  webdavConfig: WebDAVConfig | null
  passwordReady: boolean
  setPasswordReady: (ready: boolean) => void
  setSearchMode: (mode: SearchMode) => void
  setQuery: (query: string) => void
  setSyncStatus: (status: SyncStatus) => void
  setSyncProvider: (p: SyncProviderType) => void
  setS3Config: (cfg: S3Config | null) => void
  setWebDAVConfig: (cfg: WebDAVConfig | null) => void
  setActiveNoteId: (id?: string) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  createNote: () => Promise<string>
  updateActiveNote: (patch: Pick<Note, 'title' | 'content' | 'embedding'> & { contentHash: string }) => Promise<void>
  deleteNoteById: (id: string) => Promise<void>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      query: '',
      searchMode: 'fulltext',
      syncStatus: 'idle',
      syncProvider: 'none',
      s3Config: null,
      webdavConfig: null,
      passwordReady: false,
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      setPasswordReady: (ready) => set({ passwordReady: ready }),
      setSearchMode: (searchMode) => set({ searchMode }),
      setQuery: (query) => set({ query }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setSyncProvider: (syncProvider) => set({ syncProvider }),
      setS3Config: (s3Config) => set({ s3Config }),
      setWebDAVConfig: (webdavConfig) => set({ webdavConfig }),
      setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
      createNote: async () => {
        const { run } = useLoaderStore.getState()
        return run('create-note', async () => {
          const now = new Date().toISOString()
          const id = uuidv4()
          const note: Note = {
            id,
            title: 'Untitled note',
            content: '',
            tags: [],
            embedding: [],
            createdAt: now,
            updatedAt: now,
          }
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
          embedding: [], // embeddings stored separately in db.embeddings
          tags: parseTags(content),
          updatedAt: new Date().toISOString(),
        }

        await upsertNote(updated)
        await upsertEmbedding(activeNoteId, embedding ?? [], contentHash)
      },
      deleteNoteById: async (id) => {
        const { run } = useLoaderStore.getState()
        await run('delete-note', async () => {
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
        activeNoteId:  state.activeNoteId,
        searchMode:    state.searchMode,
        syncProvider:  state.syncProvider,
        s3Config:      state.s3Config,
        webdavConfig:  state.webdavConfig,
      }),
    },
  ),
)
