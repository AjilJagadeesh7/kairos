import type { AppGet, AppSet, AppState, Note } from '../../types'

type FolderActions = Pick<AppState, 'loadFolders' | 'createFolder' | 'renameFolder' | 'deleteFolder'>

/** Write back every note whose folder changed, plus the explicit folder list. */
async function persist(updatedNotes: Note[], previous: Note[], folderList: string[]): Promise<void> {
  const { writePlainNote, writeFolderList, isPlainFolderConnected } = await import('../../sync/plainFolder')
  if (!isPlainFolderConnected()) return
  const changed = updatedNotes.filter((n, i) => n !== previous[i])
  await Promise.all(changed.map(n => writePlainNote(n).catch(() => {})))
  writeFolderList(folderList).catch(() => {})
}

/** Note-folder actions for `useAppStore`. Folders are a path on each note plus an
 *  explicit list, so empty folders survive a reload. */
export function folderActions(set: AppSet, get: AppGet): FolderActions {
  return {
    loadFolders: async () => {
      const { readFolderList, isPlainFolderConnected } = await import('../../sync/plainFolder')
      if (!isPlainFolderConnected()) return
      try {
        const folderList = await readFolderList()
        set({ folderList })
      } catch {
        // best-effort
      }
    },

    createFolder: async (path) => {
      if (!path.trim()) return
      const { folderList } = get()
      if (folderList.includes(path)) return
      const next = [...folderList, path].sort()
      set({ folderList: next })
      const { writeFolderList, isPlainFolderConnected } = await import('../../sync/plainFolder')
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
      await persist(updatedNotes, notes, nextFolderList)
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
      await persist(updatedNotes, notes, nextFolderList)
    },
  }
}
