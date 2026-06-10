import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLoaderStore } from './useLoaderStore'
import type { PenNote, PenStroke } from '../types'

// Default page is ~A4 at 96dpi; height grows as the user writes.
const DEFAULT_PAGE_WIDTH = 794
const DEFAULT_HEIGHT = 1123

interface PenNoteState {
  penNotes: PenNote[]
  /** Explicitly-created folder paths (so empty folders persist). */
  folders: string[]
  isLoaded: boolean

  loadPenNotes: () => Promise<void>
  create: (title?: string, seed?: Partial<PenNote>) => string
  updateStrokes: (id: string, strokes: PenStroke[]) => void
  setHeight: (id: string, height: number) => void
  updateTitle: (id: string, title: string) => void
  setTags: (id: string, tags: string[]) => void
  setFolder: (id: string, folder: string) => void
  setNoSync: (id: string, value: boolean) => void
  remove: (id: string) => void
  createFolder: (path: string) => void
  renameFolder: (oldPath: string, newPath: string) => void
  deleteFolder: (path: string) => void
}

// Pen notes live in the vault (vault/pennotes/<id>.json) and sync to the cloud
// like canvases — see useCanvasStore for the mirrored pattern. The explicit
// folder list is persisted to config/pennote-folders.json so empty folders
// survive a reconnect (folder *assignments* travel with each note's `folder`).
export const usePenNoteStore = create<PenNoteState>()(
  persist(
    (set, get) => ({
      penNotes: [],
      folders: [],
      isLoaded: false,

      loadPenNotes: async () => {
        const { readAllPenNotes, readPenNoteFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (!isPlainFolderConnected()) { set({ isLoaded: true }); return }
        await useLoaderStore.getState().run('load-pennotes', async () => {
          try {
            const [vaultNotes, vaultFolders] = await Promise.all([readAllPenNotes(), readPenNoteFolderList()])
            // One-time migration: pen notes used to live only in localStorage
            // (key `kairos-pennotes`). Pull any not yet in the vault into it.
            const { penNotes, folders } = await migrateLegacyPenNotes(vaultNotes, vaultFolders)
            penNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            set({ penNotes, folders, isLoaded: true })
          } catch (err) {
            console.warn('[pennote] loadPenNotes failed:', err)
            set({ isLoaded: true })
          }
        })
      },

      create: (title = 'Untitled pen note', seed) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const penNote: PenNote = {
          id, title, strokes: [],
          pageWidth: DEFAULT_PAGE_WIDTH, height: DEFAULT_HEIGHT,
          tags: [], createdAt: now, updatedAt: now,
          ...seed,
        }
        set(s => ({ penNotes: [penNote, ...s.penNotes] }))
        void fsUpsert(penNote)
        return id
      },

      updateStrokes: (id, strokes) => {
        set(s => ({
          penNotes: s.penNotes.map(p => p.id === id ? { ...p, strokes, updatedAt: new Date().toISOString() } : p),
        }))
        fsUpsertId(get, id)
      },

      setHeight: (id, height) => {
        set(s => ({
          penNotes: s.penNotes.map(p => p.id === id && height > p.height ? { ...p, height } : p),
        }))
        fsUpsertId(get, id)
      },

      updateTitle: (id, title) => {
        set(s => ({
          penNotes: s.penNotes.map(p => p.id === id ? { ...p, title, updatedAt: new Date().toISOString() } : p),
        }))
        fsUpsertId(get, id)
      },

      setTags: (id, tags) => {
        set(s => ({
          penNotes: s.penNotes.map(p => p.id === id ? { ...p, tags, updatedAt: new Date().toISOString() } : p),
        }))
        fsUpsertId(get, id)
      },

      setFolder: (id, folder) => {
        set(s => ({
          penNotes: s.penNotes.map(p => p.id === id ? { ...p, folder: folder || undefined, updatedAt: new Date().toISOString() } : p),
        }))
        fsUpsertId(get, id)
      },

      setNoSync: (id, value) => {
        set(s => ({
          penNotes: s.penNotes.map(p => p.id === id ? { ...p, noSync: value || undefined, updatedAt: new Date().toISOString() } : p),
        }))
        const penNote = get().penNotes.find(p => p.id === id)
        if (penNote) void persistAndPushNow(penNote)  // immediate, not debounced
      },

      remove: (id) => {
        set(s => ({ penNotes: s.penNotes.filter(p => p.id !== id) }))
        void fsDel(id)
      },

      createFolder: (path) => {
        const next = get().folders.includes(path) ? get().folders : [...get().folders, path]
        set({ folders: next })
        void fsWriteFolders(next)
      },

      renameFolder: (oldPath, newPath) => {
        const repath = (p?: string) =>
          p === oldPath ? newPath
          : p?.startsWith(oldPath + '/') ? newPath + p.slice(oldPath.length)
          : p
        const before = get().penNotes
        const folders = [...new Set(get().folders.map(f => repath(f) ?? f))]
        const penNotes = before.map(p => p.folder === repath(p.folder) ? p : { ...p, folder: repath(p.folder), updatedAt: new Date().toISOString() })
        set({ folders, penNotes })
        void fsWriteFolders(folders)
        penNotes.forEach((p, i) => { if (p !== before[i]) void fsUpsert(p) })
      },

      deleteFolder: (path) => {
        const before = get().penNotes
        // Remove the folder and descendants; move their notes up to root.
        const folders = get().folders.filter(f => f !== path && !f.startsWith(path + '/'))
        const penNotes = before.map(p =>
          p.folder === path || p.folder?.startsWith(path + '/')
            ? { ...p, folder: undefined, updatedAt: new Date().toISOString() }
            : p)
        set({ folders, penNotes })
        void fsWriteFolders(folders)
        penNotes.forEach((p, i) => { if (p !== before[i]) void fsUpsert(p) })
      },
    }),
    {
      name: 'kairos-pennotes',
      // Vault is the source of truth; nothing is persisted to localStorage.
      partialize: () => ({}),
    },
  ),
)

/**
 * Migrate pen notes left in the old localStorage blob (`kairos-pennotes`) into
 * the vault. Returns the merged list. Notes already in the vault win; legacy
 * notes are written to disk + queued for cloud push. Runs once — the legacy
 * key is cleared after a successful migration.
 */
async function migrateLegacyPenNotes(
  vaultNotes: PenNote[],
  vaultFolders: string[],
): Promise<{ penNotes: PenNote[]; folders: string[] }> {
  let legacy: { penNotes?: PenNote[]; folders?: string[] } = {}
  try {
    const raw = localStorage.getItem('kairos-pennotes')
    if (raw) legacy = (JSON.parse(raw)?.state ?? {}) as typeof legacy
  } catch { /* nothing to migrate */ }

  const legacyNotes = legacy.penNotes ?? []
  const haveIds = new Set(vaultNotes.map(p => p.id))
  const toMigrate = legacyNotes.filter(p => !haveIds.has(p.id))
  if (legacyNotes.length === 0) return { penNotes: vaultNotes, folders: vaultFolders }

  const folders = [...new Set([...vaultFolders, ...(legacy.folders ?? [])])]
  if (toMigrate.length) {
    await Promise.all(toMigrate.map(p => fsUpsert(p)))
    await fsWriteFolders(folders)
  }
  // Clear the legacy blob so this only runs once.
  try { localStorage.removeItem('kairos-pennotes') } catch { /* ignore */ }

  return { penNotes: [...vaultNotes, ...toMigrate], folders }
}

/** Look the note up by id (post-set) and persist + schedule its cloud push. */
function fsUpsertId(get: () => PenNoteState, id: string): void {
  const penNote = get().penNotes.find(p => p.id === id)
  if (penNote) void fsUpsert(penNote)
}

async function fsUpsert(penNote: PenNote): Promise<void> {
  const { writePlainPenNote, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    writePlainPenNote(penNote).catch(e => console.warn('[pennote] save failed:', e))
  }
  const { schedulePush } = await import('../sync/debouncedCloudPush')
  schedulePush('pennote', penNote.id, penNote)
}

async function fsDel(id: string): Promise<void> {
  const { deletePlainPenNote, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    deletePlainPenNote(id).catch(e => console.warn('[pennote] delete failed:', e))
  }
  const { pushDelete } = await import('../sync/debouncedCloudPush')
  pushDelete('pennote', id, `${id}.json`)
}

async function fsWriteFolders(folders: string[]): Promise<void> {
  const { writePenNoteFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    writePenNoteFolderList(folders).catch(e => console.warn('[pennote] folder save failed:', e))
  }
}

/** Write locally and push to the cloud immediately (used for sync opt-out toggles). */
async function persistAndPushNow(penNote: PenNote): Promise<void> {
  const { writePlainPenNote, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    writePlainPenNote(penNote).catch(e => console.warn('[pennote] save failed:', e))
  }
  const { pushContentToAll } = await import('../sync/syncOrchestrator')
  void pushContentToAll('pennote', penNote)  // deletes cloud copy when noSync
}
