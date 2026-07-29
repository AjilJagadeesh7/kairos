/**
 * Attachment files — `vault/attachments/<folder>/<name>` plus the
 * `attachments/attachments.json` manifest.
 *
 * Standalone files, organized into folders like notes. The IndexedDB blob is the
 * primary copy; these helpers mirror it into the vault so files are visible on
 * disk and travel with a folder sync. The manifest maps each file's id/folder so
 * other devices can reconstruct records on pull.
 */
import {
  isPlainFolderConnected, readVaultBytes, readVaultText, removeVaultFile,
  vaultFileUrl, writeVaultBytes, writeVaultText,
} from './vaultFs'

const ATTACHMENT_MANIFEST = 'attachments/attachments.json'

/** Vault-relative directory for a folder (no leading slash). "" → attachments/. */
function attRelDir(folder?: string): string {
  const f = (folder ?? '').replace(/^\/+|\/+$/g, '')
  return f ? `attachments/${f}` : 'attachments'
}

function attRelPath(folder: string | undefined, name: string): string {
  return `${attRelDir(folder)}/${name}`
}

export async function writePlainAttachment(folder: string | undefined, name: string, bytes: Uint8Array): Promise<void> {
  if (!isPlainFolderConnected()) return
  await writeVaultBytes(attRelPath(folder, name), bytes)
}

export async function readPlainAttachment(folder: string | undefined, name: string): Promise<Uint8Array | null> {
  if (!isPlainFolderConnected()) return null
  return readVaultBytes(attRelPath(folder, name))
}

export async function deletePlainAttachment(folder: string | undefined, name: string): Promise<void> {
  if (!isPlainFolderConnected()) return
  await removeVaultFile(attRelPath(folder, name))
}

/** A webview-loadable URL for a vault attachment file, or null when unavailable. */
export async function plainAttachmentUrl(folder: string | undefined, name: string): Promise<string | null> {
  if (!isPlainFolderConnected()) return null
  return vaultFileUrl(attRelPath(folder, name))
}

export async function writeAttachmentManifest(content: string): Promise<void> {
  if (!isPlainFolderConnected()) return
  await writeVaultText(ATTACHMENT_MANIFEST, content)
}

export async function readAttachmentManifest(): Promise<string | null> {
  if (!isPlainFolderConnected()) return null
  return readVaultText(ATTACHMENT_MANIFEST)
}
