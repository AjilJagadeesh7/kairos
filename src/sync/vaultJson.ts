/**
 * Vault collections stored as one JSON file per item — kanban boards
 * (`vault/kanban/`), canvases (`vault/canvas/`) and pen notes (`vault/pennotes/`).
 * All three behave identically apart from their directory and record type.
 */
import { isPlainFolderConnected, listVaultDir, readVaultText, removeVaultFile, writeVaultText } from './vaultFs'
import type { Board } from '../types/kanban.types'
import type { Canvas } from '../types/canvas.types'
import type { PenNote } from '../types/penNote.types'

async function writeItem(dir: string, id: string, data: unknown): Promise<void> {
  await writeVaultText(`${dir}/${id}.json`, JSON.stringify(data, null, 2))
}

function deleteItem(dir: string, id: string): Promise<void> {
  return removeVaultFile(`${dir}/${id}.json`)
}

/** Every parseable `*.json` in the directory; malformed files are skipped. */
async function readItems<T>(dir: string): Promise<T[]> {
  if (!isPlainFolderConnected()) return []
  const names = (await listVaultDir(dir)).filter(n => n.endsWith('.json'))
  const items: T[] = []
  for (const name of names) {
    const raw = await readVaultText(`${dir}/${name}`)
    if (raw === null) continue
    try { items.push(JSON.parse(raw) as T) } catch { /* skip malformed */ }
  }
  return items
}

// ── Kanban boards ────────────────────────────────────────────────────────────

export const writePlainBoard  = (board: Board) => writeItem('kanban', board.id, board)
export const deletePlainBoard = (boardId: string) => deleteItem('kanban', boardId)
export const readAllBoards    = () => readItems<Board>('kanban')

// ── Canvases ─────────────────────────────────────────────────────────────────

export const writePlainCanvas  = (canvas: Canvas) => writeItem('canvas', canvas.id, canvas)
export const deletePlainCanvas = (canvasId: string) => deleteItem('canvas', canvasId)
export const readAllCanvases   = () => readItems<Canvas>('canvas')

// ── Pen notes ────────────────────────────────────────────────────────────────

export const writePlainPenNote  = (penNote: PenNote) => writeItem('pennotes', penNote.id, penNote)
export const deletePlainPenNote = (penNoteId: string) => deleteItem('pennotes', penNoteId)
export const readAllPenNotes    = () => readItems<PenNote>('pennotes')
