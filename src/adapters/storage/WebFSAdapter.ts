import type { StorageAdapter } from './StorageAdapter'
import { db } from '../../db/schema'
import { IndexDBAdapter } from './IndexDBAdapter'

const HANDLE_KEY = 'webFSAdapter_vault'

/**
 * StorageAdapter for web browsers that support the File System Access API
 * (Chrome / Edge / Opera). The user picks a local folder via showDirectoryPicker();
 * the resulting FileSystemDirectoryHandle is persisted in IndexedDB so
 * subsequent page loads can re-verify access without showing the picker again.
 *
 * If showDirectoryPicker is unavailable this adapter must not be instantiated —
 * use IndexDBAdapter instead (enforced by the factory in index.ts).
 */
export class WebFSAdapter implements StorageAdapter {
  private handle: FileSystemDirectoryHandle | null = null

  /** Restore a previously granted handle from IndexedDB, if permission is still valid. */
  async init(): Promise<boolean> {
    try {
      const rec = await db.fileHandles.get(HANDLE_KEY)
      if (!rec?.handle) return false
      const h = rec.handle as FileSystemDirectoryHandle
      const perm = await h.queryPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        this.handle = h
        return true
      }
      // Permission was revoked — try to re-request (requires user gesture)
      const req = await h.requestPermission({ mode: 'readwrite' })
      if (req === 'granted') {
        this.handle = h
        return true
      }
    } catch {
      // Handle is stale or unavailable
    }
    return false
  }

  /**
   * Show the directory picker.
   * Must be called from a user gesture (button click, etc.).
   */
  async connect(): Promise<void> {
    const h = await window.showDirectoryPicker({ mode: 'readwrite' })
    this.handle = h
    await db.fileHandles.put({ key: HANDLE_KEY, handle: h as unknown })
  }

  async disconnect(): Promise<void> {
    this.handle = null
    await db.fileHandles.delete(HANDLE_KEY)
  }

  isConnected(): boolean {
    return this.handle !== null
  }

  getFolderName(): string | null {
    return this.handle?.name ?? null
  }

  private assertConnected(): FileSystemDirectoryHandle {
    if (!this.handle) throw new Error('WebFSAdapter: no folder connected. Call connect() first.')
    return this.handle
  }

  async read(path: string): Promise<string> {
    const root = this.assertConnected()
    const fileHandle = await root.getFileHandle(path)
    const file = await fileHandle.getFile()
    return file.text()
  }

  async write(path: string, content: string): Promise<void> {
    const root = this.assertConnected()
    const fileHandle = await root.getFileHandle(path, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async delete(path: string): Promise<void> {
    const root = this.assertConnected()
    await root.removeEntry(path)
  }

  async list(_dir: string): Promise<string[]> {
    const root = this.assertConnected()
    const names: string[] = []
    for await (const [name, entry] of root.entries()) {
      if (entry.kind === 'file' && name.endsWith('.md')) names.push(name)
    }
    return names
  }

  async exists(path: string): Promise<boolean> {
    const root = this.assertConnected()
    try {
      await root.getFileHandle(path)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Resolve the right web storage adapter based on browser support and user preference.
 * Shows a one-time choice prompt for new users.
 * Returns an IndexDBAdapter fallback when File System Access API is unavailable.
 */
export async function resolveWebAdapter(): Promise<StorageAdapter> {
  const supportsFS = 'showDirectoryPicker' in window
  const choice = localStorage.getItem('mindvault_storage_choice')

  if (!supportsFS || choice === 'indexdb') {
    if (!supportsFS && !choice) {
      // Silently fall through — the factory will surface the no-support notice
    }
    return new IndexDBAdapter()
  }

  if (choice === 'local') {
    const adapter = new WebFSAdapter()
    const restored = await adapter.init()
    if (restored) return adapter
    // Handle revoked or missing — user will need to reconnect via Settings
    return adapter
  }

  // No choice made yet — return IndexDB for now; onboarding UI will prompt
  return new IndexDBAdapter()
}
