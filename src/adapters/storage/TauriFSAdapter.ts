import type { StorageAdapter } from './StorageAdapter'

const VAULT_ROOT_KEY = 'kairos_vault_root'

/**
 * StorageAdapter for Tauri desktop.
 * Uses @tauri-apps/plugin-fs for all I/O and @tauri-apps/plugin-dialog to
 * let the user pick a vault folder on first launch. The chosen path is
 * persisted in localStorage so subsequent launches skip the picker.
 */
export class TauriFSAdapter implements StorageAdapter {
  private vaultRoot: string | null = null

  private async ensureVaultRoot(): Promise<string> {
    if (this.vaultRoot) return this.vaultRoot

    const stored = localStorage.getItem(VAULT_ROOT_KEY)
    if (stored) {
      this.vaultRoot = stored
      return stored
    }

    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      title: 'Choose your Kairos folder',
      multiple: false,
    })

    if (!selected || typeof selected !== 'string') {
      throw new Error('No vault folder selected. Kairos cannot open without a storage location.')
    }

    localStorage.setItem(VAULT_ROOT_KEY, selected)
    this.vaultRoot = selected
    return selected
  }

  private async resolvePath(path: string): Promise<string> {
    const root = await this.ensureVaultRoot()
    // Avoid path traversal
    const safe = path.replace(/\.\.\//g, '')
    return `${root}/${safe}`
  }

  async read(path: string): Promise<string> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const full = await this.resolvePath(path)
    return readTextFile(full)
  }

  async write(path: string, content: string): Promise<void> {
    const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
    const full = await this.resolvePath(path)

    // Ensure parent directory exists (in case of nested paths)
    const dir = full.substring(0, full.lastIndexOf('/'))
    if (dir) {
      await mkdir(dir, { recursive: true }).catch(() => {
        // Directory already exists — ignore
      })
    }

    await writeTextFile(full, content)
  }

  async delete(path: string): Promise<void> {
    const { remove } = await import('@tauri-apps/plugin-fs')
    const full = await this.resolvePath(path)
    await remove(full)
  }

  async list(_dir: string): Promise<string[]> {
    const { readDir } = await import('@tauri-apps/plugin-fs')
    const root = await this.ensureVaultRoot()
    const entries = await readDir(root)
    return entries
      .filter((e) => !e.isDirectory && e.name?.endsWith('.md'))
      .map((e) => e.name!)
  }

  async exists(path: string): Promise<boolean> {
    const { exists } = await import('@tauri-apps/plugin-fs')
    const full = await this.resolvePath(path)
    return exists(full)
  }

  /** Reset the vault root so the user can pick a new folder. */
  resetVaultRoot(): void {
    this.vaultRoot = null
    localStorage.removeItem(VAULT_ROOT_KEY)
  }

  getVaultRoot(): string | null {
    return this.vaultRoot ?? localStorage.getItem(VAULT_ROOT_KEY)
  }
}
