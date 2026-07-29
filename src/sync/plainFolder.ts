/**
 * Plain (unencrypted) local folder — primary storage.
 *
 * Vault structure:
 *   {vault}/notes/          — one .md file per note
 *   {vault}/journal/        — one .md file per day
 *   {vault}/kanban/         — one .json file per board
 *   {vault}/canvas/         — one .json file per canvas
 *   {vault}/pennotes/       — one .json file per pen note
 *   {vault}/attachments/    — attachment files + manifest
 *   {vault}/history/        — version snapshots
 *   {vault}/config/         — settings.json and other config
 *   {vault}/plugins/{id}/   — plugin bundles + data
 *
 * This module is the public face of the vault: the filesystem primitives live in
 * `vaultFs.ts` and each content type has its own module beside it. Import from
 * here — the split below is an implementation detail.
 */
export {
  initPlainFolder, connectPlainFolder, disconnectPlainFolder,
  getVaultPath, isPlainFolderConnected, getPlainFolderName,
} from './vaultFs'

export {
  writePlainNote, deletePlainNote, readAllNotes,
  serializeJournalEntry, deserializeJournalEntry,
  writeJournalEntry, deleteJournalEntryFile, readAllJournalEntries,
} from './vaultNotes'

export {
  writePlainBoard, deletePlainBoard, readAllBoards,
  writePlainCanvas, deletePlainCanvas, readAllCanvases,
  writePlainPenNote, deletePlainPenNote, readAllPenNotes,
} from './vaultJson'

export {
  writePlainAttachment, readPlainAttachment, deletePlainAttachment,
  plainAttachmentUrl, writeAttachmentManifest, readAttachmentManifest,
} from './vaultAttachments'

export {
  appendNoteVersion, readNoteHistory, deleteNoteHistory,
  appendJournalVersion, readJournalHistory, historyTotalBytes,
} from './vaultHistory'

export {
  listPluginIds, readPluginFile, writePluginFile, deletePluginFolder,
} from './vaultPlugins'

import { readVaultText, writeVaultText } from './vaultFs'

// ---------------------------------------------------------------------------
// Config — vault/config/*.json
// ---------------------------------------------------------------------------

export function readPlainConfig(filename: string): Promise<string | null> {
  return readVaultText(`config/${filename}`)
}

export function writePlainConfig(filename: string, content: string): Promise<void> {
  return writeVaultText(`config/${filename}`, content)
}

// ---------------------------------------------------------------------------
// Folder registries — explicitly created folders, so empty ones survive a reload
// ---------------------------------------------------------------------------

async function readFolders(filename: string): Promise<string[]> {
  try {
    const raw = await readPlainConfig(filename)
    if (!raw) return []
    return (JSON.parse(raw) as { folders: string[] }).folders ?? []
  } catch {
    return []
  }
}

function writeFolders(filename: string, folders: string[]): Promise<void> {
  return writePlainConfig(filename, JSON.stringify({ folders }))
}

/** Note folders — config/folders.json. */
export const readFolderList  = () => readFolders('folders.json')
export const writeFolderList = (folders: string[]) => writeFolders('folders.json', folders)

/** Attachment folders — config/attachment-folders.json. */
export const readAttachmentFolderList  = () => readFolders('attachment-folders.json')
export const writeAttachmentFolderList = (folders: string[]) => writeFolders('attachment-folders.json', folders)

/** Pen-note folders — config/pennote-folders.json. */
export const readPenNoteFolderList  = () => readFolders('pennote-folders.json')
export const writePenNoteFolderList = (folders: string[]) => writeFolders('pennote-folders.json', folders)
