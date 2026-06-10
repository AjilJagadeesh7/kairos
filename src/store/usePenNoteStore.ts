import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PenNote, PenStroke } from '../types'

// Default page is ~A4 at 96dpi; height grows as the user writes.
const DEFAULT_PAGE_WIDTH = 794
const DEFAULT_HEIGHT = 1123

interface PenNoteState {
  penNotes: PenNote[]
  /** Explicitly-created folder paths (so empty folders persist). */
  folders: string[]
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

// NOTE: persistence is currently local (localStorage). Moving pen notes into
// the vault (vault/pennotes/<id>.json) + cloud sync — mirroring useCanvasStore —
// is the next step so they sync across devices like other content.
export const usePenNoteStore = create<PenNoteState>()(
  persist(
    (set) => ({
      penNotes: [],
      folders: [],

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
        return id
      },

      updateStrokes: (id, strokes) => set(s => ({
        penNotes: s.penNotes.map(p => p.id === id ? { ...p, strokes, updatedAt: new Date().toISOString() } : p),
      })),

      setHeight: (id, height) => set(s => ({
        penNotes: s.penNotes.map(p => p.id === id && height > p.height ? { ...p, height } : p),
      })),

      updateTitle: (id, title) => set(s => ({
        penNotes: s.penNotes.map(p => p.id === id ? { ...p, title, updatedAt: new Date().toISOString() } : p),
      })),

      setTags: (id, tags) => set(s => ({
        penNotes: s.penNotes.map(p => p.id === id ? { ...p, tags, updatedAt: new Date().toISOString() } : p),
      })),

      setFolder: (id, folder) => set(s => ({
        penNotes: s.penNotes.map(p => p.id === id ? { ...p, folder: folder || undefined, updatedAt: new Date().toISOString() } : p),
      })),

      setNoSync: (id, value) => set(s => ({
        penNotes: s.penNotes.map(p => p.id === id ? { ...p, noSync: value || undefined } : p),
      })),

      remove: (id) => set(s => ({ penNotes: s.penNotes.filter(p => p.id !== id) })),

      createFolder: (path) => set(s => (
        s.folders.includes(path) ? s : { folders: [...s.folders, path] }
      )),

      renameFolder: (oldPath, newPath) => set(s => {
        const repath = (p?: string) =>
          p === oldPath ? newPath
          : p?.startsWith(oldPath + '/') ? newPath + p.slice(oldPath.length)
          : p
        return {
          folders: [...new Set(s.folders.map(f => repath(f) ?? f))],
          penNotes: s.penNotes.map(p => ({ ...p, folder: repath(p.folder) })),
        }
      }),

      deleteFolder: (path) => set(s => ({
        // Remove the folder and descendants; move their notes up to root.
        folders: s.folders.filter(f => f !== path && !f.startsWith(path + '/')),
        penNotes: s.penNotes.map(p =>
          p.folder === path || p.folder?.startsWith(path + '/')
            ? { ...p, folder: undefined }
            : p),
      })),
    }),
    { name: 'kairos-pennotes' },
  ),
)
