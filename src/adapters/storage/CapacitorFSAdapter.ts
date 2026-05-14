import type { StorageAdapter } from './StorageAdapter'

const VAULT_DIR = 'MindVault'

/**
 * StorageAdapter for Capacitor (iOS / Android).
 * Vault root: Documents/MindVault/ via @capacitor/filesystem.
 * Notes are stored as plain .md files with YAML frontmatter.
 */
export class CapacitorFSAdapter implements StorageAdapter {
  private async getFilesystem() {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    return { Filesystem, Directory, Encoding }
  }

  private async ensureVaultDir(): Promise<void> {
    const { Filesystem, Directory } = await this.getFilesystem()
    try {
      await Filesystem.mkdir({
        path: VAULT_DIR,
        directory: Directory.Documents,
        recursive: true,
      })
    } catch {
      // Directory already exists — ignore
    }
  }

  async read(path: string): Promise<string> {
    const { Filesystem, Directory, Encoding } = await this.getFilesystem()
    const result = await Filesystem.readFile({
      path: `${VAULT_DIR}/${path}`,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    })
    return result.data as string
  }

  async write(path: string, content: string): Promise<void> {
    const { Filesystem, Directory, Encoding } = await this.getFilesystem()
    await this.ensureVaultDir()
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/${path}`,
      directory: Directory.Documents,
      data: content,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  }

  async delete(path: string): Promise<void> {
    const { Filesystem, Directory } = await this.getFilesystem()
    await Filesystem.deleteFile({
      path: `${VAULT_DIR}/${path}`,
      directory: Directory.Documents,
    })
  }

  async list(_dir: string): Promise<string[]> {
    const { Filesystem, Directory } = await this.getFilesystem()
    await this.ensureVaultDir()
    const result = await Filesystem.readdir({
      path: VAULT_DIR,
      directory: Directory.Documents,
    })
    return result.files
      .filter((f) => f.name.endsWith('.md'))
      .map((f) => f.name)
  }

  async exists(path: string): Promise<boolean> {
    const { Filesystem, Directory } = await this.getFilesystem()
    try {
      await Filesystem.stat({
        path: `${VAULT_DIR}/${path}`,
        directory: Directory.Documents,
      })
      return true
    } catch {
      return false
    }
  }
}
