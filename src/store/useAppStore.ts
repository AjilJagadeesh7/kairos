import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { upsertEmbedding } from '../db/schema'
import { useLoaderStore } from './useLoaderStore'
import type { Note, SearchMode, SyncStatus, ThemeMode, StorageTarget, FontOption, FontWeight } from '../types'
import type { S3Config } from '../sync/s3'
import type { WebDAVConfig } from '../sync/webdav'
import { parseTags } from '../utils/wikilinks'
import { buildIndex, indexNote, deindexNote } from '../search/noteIndex'

type AppState = {
  notes: Note[]
  isNotesLoaded: boolean
  activeNoteId?: string
  query: string
  searchMode: SearchMode
  syncStatus: SyncStatus
  storageChoices: StorageTarget[]
  theme: ThemeMode
  font: FontOption
  fontWeight: FontWeight
  aiUrl: string
  s3Config: S3Config | null
  webdavConfig: WebDAVConfig | null
  mobileSidebarOpen: boolean
  noteTagColors: Record<string, string>
  userName: string
  onboardingDone: boolean

  setUserName: (name: string) => void
  completeOnboarding: () => void

  setTheme: (t: ThemeMode) => void
  setFont: (f: FontOption) => void
  setFontWeight: (w: FontWeight) => void
  setAiUrl: (url: string) => void
  setSearchMode: (mode: SearchMode) => void
  setQuery: (query: string) => void
  setSyncStatus: (status: SyncStatus) => void
  setS3Config: (cfg: S3Config | null) => void
  setWebDAVConfig: (cfg: WebDAVConfig | null) => void
  setActiveNoteId: (id?: string) => void
  setMobileSidebarOpen: (open: boolean) => void
  setStorageChoices: (choices: StorageTarget[]) => void
  setNoteTagColor: (tagName: string, color: string) => void
  removeNoteTag: (tagName: string) => void

  loadNotes: () => Promise<void>
  createNote: () => Promise<string>
  updateActiveNote: (patch: Pick<Note, 'title' | 'content' | 'embedding'> & { contentHash: string }) => Promise<void>
  updateNoteTags: (noteId: string, tags: string[]) => Promise<void>
  appendWikilink: (noteId: string, targetTitle: string) => Promise<void>
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
      notes: [],
      isNotesLoaded: false,
      query: '',
      searchMode: 'fulltext',
      syncStatus: 'idle',
      s3Config: null,
      webdavConfig: null,
      mobileSidebarOpen: false,
      noteTagColors: {},
      storageChoices: readLegacyStorageChoices(),
      theme: (localStorage.getItem('mindvault.theme') as ThemeMode | null) ?? 'light',
      font: (localStorage.getItem('mindvault.font') as FontOption | null) ?? 'manrope',
      fontWeight: (localStorage.getItem('mindvault.fontWeight') as FontWeight | null) ?? 'regular',
      aiUrl: 'http://localhost:11434',
      userName: '',
      onboardingDone: false,

      setUserName: (userName) => set({ userName }),
      completeOnboarding: () => set({ onboardingDone: true }),

      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      setFontWeight: (fontWeight) => set({ fontWeight }),
      setAiUrl: (aiUrl) => set({ aiUrl }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      setSearchMode: (searchMode) => set({ searchMode }),
      setQuery: (query) => set({ query }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setS3Config: (s3Config) => set({ s3Config }),
      setWebDAVConfig: (webdavConfig) => set({ webdavConfig }),
      setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
      setStorageChoices: (storageChoices) => set({ storageChoices }),
      setNoteTagColor: (tagName, color) => set(s => ({ noteTagColors: { ...s.noteTagColors, [tagName]: color } })),
      removeNoteTag: (tagName) => set(s => {
        const { [tagName]: _, ...rest } = s.noteTagColors
        return { noteTagColors: rest }
      }),

      loadNotes: async () => {
        const { readAllNotes, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (!isPlainFolderConnected()) {
          set({ isNotesLoaded: true })
          return
        }
        try {
          const notes = await readAllNotes()
          // Sort by updatedAt desc
          notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          buildIndex(notes)
          set({ notes, isNotesLoaded: true })
        } catch (err) {
          console.warn('[loadNotes] failed:', err)
          set({ isNotesLoaded: true })
        }
      },

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

          // Write to filesystem (primary storage)
          const { writePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
          if (isPlainFolderConnected()) {
            await writePlainNote(note)
          }

          // Add to in-memory store and search index
          indexNote(note)
          set(s => ({ notes: [note, ...s.notes], activeNoteId: id }))
          return id
        }, 'Creating note…')
      },

      updateActiveNote: async ({ title, content, embedding, contentHash }) => {
        const { activeNoteId, notes } = get()
        if (!activeNoteId) return
        const existing = notes.find(n => n.id === activeNoteId)
        if (!existing) return

        const updated: Note = {
          ...existing,
          title,
          content,
          embedding: [],
          tags: parseTags(content),
          updatedAt: new Date().toISOString(),
        }

        // Update search index and in-memory store
        indexNote(updated)
        set(s => ({
          notes: [updated, ...s.notes.filter(n => n.id !== activeNoteId)],
        }))

        // Write to filesystem (primary storage)
        const { writePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          writePlainNote(updated).catch(err => console.warn('[storage] write failed:', err))
        }

        // Store embedding in Dexie (for semantic search)
        if (embedding && embedding.length > 0) {
          await upsertEmbedding(activeNoteId, embedding, contentHash)
        }

        // Background push to all connected sync providers
        const { setSyncStatus } = get()
        const { pushNoteToAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
        if (anySyncProviderConnected()) {
          setSyncStatus('syncing')
          pushNoteToAll(updated)
            .then(() => setSyncStatus('ok'))
            .catch(err => { console.warn('[sync] push failed:', err); setSyncStatus('error') })
        }
      },

      updateNoteTags: async (noteId, tags) => {
        const { notes } = get()
        const existing = notes.find(n => n.id === noteId)
        if (!existing) return
        const updated = { ...existing, tags, updatedAt: new Date().toISOString() }
        indexNote(updated)
        set(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))
        const { writePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          writePlainNote(updated).catch(err => console.warn('[storage] write failed:', err))
        }
      },

      appendWikilink: async (noteId, targetTitle) => {
        const { notes } = get()
        const existing = notes.find(n => n.id === noteId)
        if (!existing) return
        const separator = existing.content.trimEnd().length > 0 ? '\n\n' : ''
        const updated = { ...existing, content: `${existing.content.trimEnd()}${separator}[[${targetTitle}]]`, updatedAt: new Date().toISOString() }
        set(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))
        const { writePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) writePlainNote(updated).catch(err => console.warn('[storage] write failed:', err))
      },

      deleteNoteById: async (id) => {
        const { run } = useLoaderStore.getState()
        await run('delete-note', async () => {
          deindexNote(id)
          // Remove from in-memory store
          set(s => ({
            notes: s.notes.filter(n => n.id !== id),
            activeNoteId: s.activeNoteId === id ? undefined : s.activeNoteId,
          }))

          // Delete from filesystem
          const { deletePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
          if (isPlainFolderConnected()) {
            await deletePlainNote(id).catch(() => { /* best-effort */ })
          }

          // Remove from sync providers
          const { deleteNoteFromAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
          if (anySyncProviderConnected()) await deleteNoteFromAll(id)
        }, 'Deleting note…')
      },
    }),
    {
      name: 'mindvault-ui-store',
      partialize: (state) => ({
        activeNoteId:    state.activeNoteId,
        searchMode:      state.searchMode,
        s3Config:        state.s3Config,
        webdavConfig:    state.webdavConfig,
        storageChoices:  state.storageChoices,
        noteTagColors:   state.noteTagColors,
        theme:           state.theme,
        font:            state.font,
        fontWeight:      state.fontWeight,
        aiUrl:           state.aiUrl,
        userName:        state.userName,
        onboardingDone:  state.onboardingDone,
      }),
    },
  ),
)
