import { create } from 'zustand'
import { getAllAttachments } from '../db/schema'
import {
  importAttachment,
  removeAttachment,
  renameAttachment as svcRename,
  moveAttachment as svcMove,
  attachmentRef,
  ATTACHMENTS_CHANGED_EVENT,
} from '../attachments/attachmentService'
import type { Attachment } from '../types'

type AttachmentState = {
  attachments: Attachment[]
  folderList: string[]
  isLoaded: boolean

  loadAttachments: () => Promise<void>
  importFiles: (files: FileList | File[], folder?: string) => Promise<Attachment[]>
  renameAttachment: (id: string, name: string) => Promise<void>
  moveToFolder: (id: string, folder: string | undefined) => Promise<void>
  deleteAttachment: (id: string) => Promise<void>
  createFolder: (path: string) => Promise<void>
  renameFolder: (oldPath: string, newPath: string) => Promise<void>
  deleteFolder: (path: string) => Promise<void>
}

async function refreshList(set: (p: Partial<AttachmentState>) => void): Promise<void> {
  set({ attachments: await getAllAttachments() })
}

export const useAttachmentStore = create<AttachmentState>()((set, get) => ({
  attachments: [],
  folderList: [],
  isLoaded: false,

  loadAttachments: async () => {
    const {
      isPlainFolderConnected, readAttachmentManifest, readAttachmentFolderList,
    } = await import('../sync/plainFolder')
    // Rebuild any IndexedDB blobs missing from the vault (e.g. after a folder pull).
    if (isPlainFolderConnected()) {
      const manifest = await readAttachmentManifest().catch(() => null)
      if (manifest) {
        const { hydrateFromVault } = await import('../attachments/attachmentService')
        await hydrateFromVault(manifest).catch(() => {})
      }
    }
    const folderList = isPlainFolderConnected() ? await readAttachmentFolderList().catch(() => []) : []

    // Self-heal: drop any leftover pre-v11 records (owner-scoped shape, no `name`)
    // that a dev/HMR upgrade may have missed clearing, so the tree never sees them.
    const all = await getAllAttachments()
    const valid = all.filter(a => typeof a.name === 'string' && a.name.length > 0)
    if (valid.length !== all.length) {
      const { db } = await import('../db/schema')
      await db.attachments.bulkDelete(all.filter(a => !valid.includes(a)).map(a => a.id)).catch(() => {})
    }
    set({ attachments: valid, folderList, isLoaded: true })
  },

  importFiles: async (files, folder) => {
    const added: Attachment[] = []
    for (const file of Array.from(files)) {
      const rec = await importAttachment(file, folder)
      if (rec) added.push(rec)
    }
    await refreshList(set)
    return added
  },

  renameAttachment: async (id, name) => {
    const rec = get().attachments.find(a => a.id === id)
    if (!rec || !name.trim()) return
    await svcRename(rec, name.trim())
    await refreshList(set)
  },

  moveToFolder: async (id, folder) => {
    const rec = get().attachments.find(a => a.id === id)
    if (!rec) return
    await svcMove(rec, folder || undefined)
    await refreshList(set)
  },

  deleteAttachment: async (id) => {
    const rec = get().attachments.find(a => a.id === id)
    if (!rec) return
    const { trashAttachment } = await import('../trash/trashService')
    await trashAttachment(rec).catch(err => console.warn('[trash] capture failed:', err))
    // Ask the open editor to drop any node referencing this attachment.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mv:strip-attachment', { detail: { ref: attachmentRef(id) } }))
    }
    await removeAttachment(rec)
    await refreshList(set)
  },

  createFolder: async (path) => {
    const p = path.trim()
    if (!p || get().folderList.includes(p)) return
    const next = [...get().folderList, p].sort()
    set({ folderList: next })
    const { writeAttachmentFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) void writeAttachmentFolderList(next).catch(() => {})
  },

  renameFolder: async (oldPath, newPath) => {
    const np = newPath.trim()
    if (!np || oldPath === np) return
    const { attachments, folderList } = get()

    // Relocate every attachment in the folder or a subfolder (moves vault files).
    const affected = attachments.filter(
      a => a.folder === oldPath || (a.folder ?? '').startsWith(oldPath + '/'),
    )
    for (const a of affected) {
      const nextFolder = a.folder === oldPath ? np : np + (a.folder ?? '').slice(oldPath.length)
      await svcMove(a, nextFolder)
    }

    const nextFolderList = folderList.map(f =>
      f === oldPath ? np : f.startsWith(oldPath + '/') ? np + f.slice(oldPath.length) : f,
    )
    set({ folderList: nextFolderList })
    const { writeAttachmentFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) void writeAttachmentFolderList(nextFolderList).catch(() => {})
    await refreshList(set)
  },

  deleteFolder: async (path) => {
    const { attachments, folderList } = get()
    // Move contained attachments (this folder + subfolders) back to the root.
    const affected = attachments.filter(
      a => a.folder === path || (a.folder ?? '').startsWith(path + '/'),
    )
    for (const a of affected) await svcMove(a, undefined)

    const nextFolderList = folderList.filter(f => f !== path && !f.startsWith(path + '/'))
    set({ folderList: nextFolderList })
    const { writeAttachmentFolderList, isPlainFolderConnected } = await import('../sync/plainFolder')
    if (isPlainFolderConnected()) void writeAttachmentFolderList(nextFolderList).catch(() => {})
    await refreshList(set)
  },
}))

// Refresh when attachments change outside the store (editor imports, sync pulls).
if (typeof window !== 'undefined') {
  window.addEventListener(ATTACHMENTS_CHANGED_EVENT, () => {
    void getAllAttachments().then(attachments => useAttachmentStore.setState({ attachments }))
  })
}
