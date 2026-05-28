import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { upsertEmbedding } from '../db/schema'
import { useLoaderStore } from './useLoaderStore'
import type { Note, SearchMode, SyncStatus, ThemeMode, StorageTarget, FontOption, FontWeight, VaultStatus, CustomCallout } from '../types'
import type { S3Config } from '../sync/s3'
import type { WebDAVConfig } from '../sync/webdav'
import { parseTags, rewriteWikilinksInContent } from '../utils/wikilinks'
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
  calloutColors: Record<string, string>
  customCallouts: CustomCallout[]
  sidebarOpen: boolean
  sidebarWidth: number
  userName: string
  newTabPage: string
  onboardingDone: boolean
  vaultStatus: VaultStatus
  lastSyncTime: string | null
  keyBindings: Record<string, string>
  folderList: string[]  // explicitly created folder paths (includes empty folders)
  pinnedNoteIds: string[]

  setUserName: (name: string) => void
  setNewTabPage: (path: string) => void
  completeOnboarding: () => void
  setVaultStatus: (status: VaultStatus) => void

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
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  setCalloutColor: (type: string, color: string) => void
  resetCalloutColor: (type: string) => void
  addCustomCallout: (callout: CustomCallout) => void
  removeCustomCallout: (type: string) => void
  updateCustomCallout: (type: string, patch: Partial<Omit<CustomCallout, 'type'>>) => void
  setKeyBinding: (id: string, key: string) => void
  resetKeyBinding: (id: string) => void
  pinNote: (id: string) => void
  unpinNote: (id: string) => void

  loadNotes: () => Promise<void>
  loadFolders: () => Promise<void>
  createNote: (initial?: { title?: string; content?: string; folder?: string }) => Promise<string>
  updateActiveNote: (patch: Pick<Note, 'title' | 'content' | 'embedding'> & { contentHash: string }) => Promise<void>
  updateNote: (noteId: string, patch: Pick<Note, 'title' | 'content' | 'embedding'> & { contentHash: string }) => Promise<void>
  updateNoteTags: (noteId: string, tags: string[]) => Promise<void>
  updateNoteFrontmatter: (noteId: string, fm: Record<string, unknown>) => Promise<void>
  appendWikilink: (noteId: string, targetTitle: string) => Promise<void>
  deleteNoteById: (id: string) => Promise<void>
  moveNoteToFolder: (noteId: string, folder: string) => Promise<void>
  createFolder: (path: string) => Promise<void>
  renameFolder: (oldPath: string, newPath: string) => Promise<void>
  deleteFolder: (path: string) => Promise<void>
}

function readLegacyStorageChoices(): StorageTarget[] {
  try {
    const raw = localStorage.getItem('kairos_storage_choices')
    if (raw) return JSON.parse(raw) as StorageTarget[]
  } catch { /* ignore */ }
  const legacy = localStorage.getItem('kairos_storage_choice')
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
      calloutColors: {},
      customCallouts: [],
      sidebarOpen: true,
      sidebarWidth: 260,
      storageChoices: readLegacyStorageChoices(),
      theme: (localStorage.getItem('kairos.theme') as ThemeMode | null) ?? 'light',
      font: (localStorage.getItem('kairos.font') as FontOption | null) ?? 'manrope',
      fontWeight: (localStorage.getItem('kairos.fontWeight') as FontWeight | null) ?? 'regular',
      aiUrl: 'http://localhost:11434',
      userName: '',
      newTabPage: '/',
      onboardingDone: false,
      vaultStatus: 'loading',
      lastSyncTime: null,
      keyBindings: {},
      folderList: [],
      pinnedNoteIds: [],

      setUserName: (userName) => set({ userName }),
      setNewTabPage: (newTabPage) => set({ newTabPage }),
      completeOnboarding: () => set({ onboardingDone: true }),
      setVaultStatus: (vaultStatus) => set({ vaultStatus }),

      setTheme: (theme) => {
        set({ theme })
        void import('../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
      },
      setFont: (font) => {
        set({ font })
        void import('../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
      },
      setFontWeight: (fontWeight) => {
        set({ fontWeight })
        void import('../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
      },
      setAiUrl: (aiUrl) => set({ aiUrl }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      setSearchMode: (searchMode) => set({ searchMode }),
      setQuery: (query) => set({ query }),
      setSyncStatus: (syncStatus) => {
        const updates: Partial<AppState> = { syncStatus }
        if (syncStatus === 'ok') {
          updates.lastSyncTime = new Date().toISOString()
        }
        set(updates)
      },
      setS3Config: (s3Config) => set({ s3Config }),
      setWebDAVConfig: (webdavConfig) => set({ webdavConfig }),
      setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
      setStorageChoices: (storageChoices) => set({ storageChoices }),
      setNoteTagColor: (tagName, color) => set(s => ({ noteTagColors: { ...s.noteTagColors, [tagName]: color } })),
      removeNoteTag: (tagName) => set(s => {
        const { [tagName]: _, ...rest } = s.noteTagColors
        return { noteTagColors: rest }
      }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: Math.max(180, Math.min(520, sidebarWidth)) }),
      setCalloutColor: (type, color) => set(s => ({ calloutColors: { ...s.calloutColors, [type]: color } })),
      resetCalloutColor: (type) => set(s => {
        const { [type]: _, ...rest } = s.calloutColors
        return { calloutColors: rest }
      }),
      addCustomCallout: (callout) => set(s => {
        if (s.customCallouts.some(c => c.type === callout.type)) return s
        return { customCallouts: [...s.customCallouts, callout] }
      }),
      removeCustomCallout: (type) => set(s => ({
        customCallouts: s.customCallouts.filter(c => c.type !== type),
      })),
      updateCustomCallout: (type, patch) => set(s => ({
        customCallouts: s.customCallouts.map(c => c.type === type ? { ...c, ...patch } : c),
      })),
      setKeyBinding: (id, key) => set(s => ({ keyBindings: { ...s.keyBindings, [id]: key } })),
      resetKeyBinding: (id) => set(s => {
        const { [id]: _, ...rest } = s.keyBindings
        return { keyBindings: rest }
      }),
      pinNote: (id) => set(s => ({ pinnedNoteIds: s.pinnedNoteIds.includes(id) ? s.pinnedNoteIds : [...s.pinnedNoteIds, id] })),
      unpinNote: (id) => set(s => ({ pinnedNoteIds: s.pinnedNoteIds.filter(x => x !== id) })),

      loadNotes: async () => {
        const { readAllNotes, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (!isPlainFolderConnected()) {
          set({ isNotesLoaded: true })
          return
        }
        await useLoaderStore.getState().run('load-notes', async () => {
          try {
            const notes = await readAllNotes()
            notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            buildIndex(notes)
            set({ notes, isNotesLoaded: true })
          } catch (err) {
            console.warn('[loadNotes] failed:', err)
            set({ isNotesLoaded: true })
          }
        })
      },

      loadFolders: async () => {
        const { readFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (!isPlainFolderConnected()) return
        try {
          const folderList = await readFolderList()
          set({ folderList })
        } catch {
          // best-effort
        }
      },

      createNote: async (initial) => {
        const { run } = useLoaderStore.getState()
        return run('create-note', async () => {
          const now = new Date().toISOString()
          const id = uuidv4()
          const note: Note = {
            id,
            title: initial?.title ?? 'Untitled note',
            content: initial?.content ?? '',
            tags: [],
            embedding: [],
            createdAt: now,
            updatedAt: now,
            folder: initial?.folder || undefined,
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

      updateNote: async (noteId, patch) => {
        // Temporarily set activeNoteId to the target note so updateActiveNote targets the right note
        set({ activeNoteId: noteId })
        await get().updateActiveNote(patch)
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

        // Update search index and in-memory store — in-place map keeps array
        // positions stable so sidebar items don't shift on every keystroke
        indexNote(updated)
        set(s => ({
          notes: s.notes.map(n => n.id === activeNoteId ? updated : n),
        }))

        // Auto-update wikilinks in all other notes when title changes
        const oldTitle = existing.title
        if (oldTitle && oldTitle !== title) {
          const { writePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
          const connected = isPlainFolderConnected()
          const currentNotes = get().notes
          const rewritten: Note[] = []

          for (const note of currentNotes) {
            if (note.id === activeNoteId) continue
            const newContent = rewriteWikilinksInContent(note.content, oldTitle, title)
            if (newContent === note.content) continue
            const rewrote: Note = { ...note, content: newContent, updatedAt: new Date().toISOString() }
            indexNote(rewrote)
            rewritten.push(rewrote)
          }

          if (rewritten.length > 0) {
            const rewrittenIds = new Set(rewritten.map(n => n.id))
            set(s => ({
              notes: s.notes.map(n => rewrittenIds.has(n.id) ? rewritten.find(r => r.id === n.id)! : n),
            }))
            if (connected) {
              // Fire-and-forget — don't block the save
              void Promise.all(rewritten.map(n => writePlainNote(n).catch(() => {})))
            }
            // Toast feedback
            const { toast } = await import('sonner')
            const count = rewritten.length
            toast.success(`Updated ${count} note${count > 1 ? 's' : ''} with new title`)
          }
        }

        // Write to filesystem (primary storage) and append a version snapshot
        const { writePlainNote, appendNoteVersion, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          writePlainNote(updated).catch(err => console.warn('[storage] write failed:', err))
          appendNoteVersion(updated.id, { savedAt: updated.updatedAt, title: updated.title, content: updated.content })
            .catch(err => console.warn('[history] append failed:', err))
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
            .catch(err => {
              console.warn('[sync] push failed — queued for retry:', err)
              setSyncStatus('error')
              void import('../sync/offlineQueue').then(({ enqueue }) => enqueue(updated.id))
            })
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

      updateNoteFrontmatter: async (noteId, fm) => {
        const { notes } = get()
        const existing = notes.find(n => n.id === noteId)
        if (!existing) return
        const updated = { ...existing, userFrontmatter: fm, updatedAt: new Date().toISOString() }
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

          // Delete from filesystem (note + history)
          const { deletePlainNote, deleteNoteHistory, isPlainFolderConnected } = await import('../sync/plainFolder')
          if (isPlainFolderConnected()) {
            await deletePlainNote(id).catch(() => { /* best-effort */ })
            deleteNoteHistory(id).catch(() => { /* best-effort */ })
          }

          // Remove from sync providers
          const { deleteNoteFromAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
          if (anySyncProviderConnected()) await deleteNoteFromAll(id)
        }, 'Deleting note…')
      },

      moveNoteToFolder: async (noteId, folder) => {
        const { notes } = get()
        const existing = notes.find(n => n.id === noteId)
        if (!existing) return
        const updated: Note = { ...existing, folder: folder || undefined, updatedAt: new Date().toISOString() }
        indexNote(updated)
        set(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))
        const { writePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          writePlainNote(updated).catch(err => console.warn('[storage] write failed:', err))
        }
      },

      createFolder: async (path) => {
        if (!path.trim()) return
        const { folderList } = get()
        if (folderList.includes(path)) return
        const next = [...folderList, path].sort()
        set({ folderList: next })
        const { writeFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          writeFolderList(next).catch(err => console.warn('[folders] write failed:', err))
        }
      },

      renameFolder: async (oldPath, newPath) => {
        if (!newPath.trim() || oldPath === newPath) return
        const { notes, folderList } = get()

        // Update all notes in that folder or any subfolder
        const updatedNotes = notes.map(note => {
          if (!note.folder) return note
          if (note.folder === oldPath) return { ...note, folder: newPath, updatedAt: new Date().toISOString() }
          if (note.folder.startsWith(oldPath + '/')) {
            return { ...note, folder: newPath + note.folder.slice(oldPath.length), updatedAt: new Date().toISOString() }
          }
          return note
        })

        // Update explicit folder list
        const nextFolderList = folderList.map(f => {
          if (f === oldPath) return newPath
          if (f.startsWith(oldPath + '/')) return newPath + f.slice(oldPath.length)
          return f
        })

        set({ notes: updatedNotes, folderList: nextFolderList })

        // Persist all changed notes
        const { writePlainNote, writeFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          const changed = updatedNotes.filter((n, i) => n !== notes[i])
          await Promise.all(changed.map(n => writePlainNote(n).catch(() => {})))
          writeFolderList(nextFolderList).catch(() => {})
        }
      },

      deleteFolder: async (path) => {
        const { notes, folderList } = get()

        // Move all notes in this folder (and subfolders) to root
        const updatedNotes = notes.map(note => {
          if (!note.folder) return note
          if (note.folder === path || note.folder.startsWith(path + '/')) {
            return { ...note, folder: undefined, updatedAt: new Date().toISOString() }
          }
          return note
        })

        // Remove folder and all subfolders from explicit list
        const nextFolderList = folderList.filter(f => f !== path && !f.startsWith(path + '/'))

        set({ notes: updatedNotes, folderList: nextFolderList })

        const { writePlainNote, writeFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          const changed = updatedNotes.filter((n, i) => n !== notes[i])
          await Promise.all(changed.map(n => writePlainNote(n).catch(() => {})))
          writeFolderList(nextFolderList).catch(() => {})
        }
      },
    }),
    {
      name: 'kairos-ui-store',
      partialize: (state) => ({
        activeNoteId:    state.activeNoteId,
        searchMode:      state.searchMode,
        s3Config:        state.s3Config,
        webdavConfig:    state.webdavConfig,
        storageChoices:  state.storageChoices,
        noteTagColors:   state.noteTagColors,
        calloutColors:   state.calloutColors,
        customCallouts:  state.customCallouts,
        sidebarOpen:     state.sidebarOpen,
        sidebarWidth:    state.sidebarWidth,
        theme:           state.theme,
        font:            state.font,
        fontWeight:      state.fontWeight,
        aiUrl:           state.aiUrl,
        userName:        state.userName,
        newTabPage:      state.newTabPage,
        onboardingDone:  state.onboardingDone,
        keyBindings:     state.keyBindings,
        pinnedNoteIds:   state.pinnedNoteIds,
      }),
    },
  ),
)
