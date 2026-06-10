import type { PenNote } from '../types'

export interface PenFolderNode {
  path: string                 // "" = root, "Lectures", "Lectures/Physics"
  name: string                 // last segment
  children: PenFolderNode[]
  notes: PenNote[]             // pen notes directly in this folder
}

/**
 * Build a virtual folder tree from the flat pen-note list plus an explicit
 * folder registry (so empty folders persist). Mirrors utils/folderTree for
 * notes, kept separate to avoid coupling the notes sidebar to pen notes.
 */
export function buildPenFolderTree(notes: PenNote[], explicitFolders: string[]): PenFolderNode {
  const allPaths = new Set<string>(explicitFolders.filter(Boolean))
  for (const note of notes) {
    if (!note.folder) continue
    const parts = note.folder.split('/')
    for (let i = 1; i <= parts.length; i++) allPaths.add(parts.slice(0, i).join('/'))
  }

  const root: PenFolderNode = { path: '', name: '', children: [], notes: [] }
  const nodeMap = new Map<string, PenFolderNode>([['', root]])

  for (const path of [...allPaths].sort()) {
    const parts = path.split('/')
    const node: PenFolderNode = { path, name: parts[parts.length - 1], children: [], notes: [] }
    nodeMap.set(path, node)
    ;(nodeMap.get(parts.slice(0, -1).join('/')) ?? root).children.push(node)
  }

  for (const note of notes) {
    ;(nodeMap.get(note.folder ?? '') ?? root).notes.push(note)
  }

  function sort(node: PenFolderNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    node.notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    node.children.forEach(sort)
  }
  sort(root)
  return root
}
