import type { Note } from '../types'

export interface FolderNode {
  path: string       // full path: "" = root, "Projects", "Projects/Work"
  name: string       // last segment only: "" = root, "Projects", "Work"
  children: FolderNode[]
  notes: Note[]      // notes directly in this folder (not in subfolders)
}

/**
 * Build a virtual folder tree from the flat note list and an explicit folder
 * registry (so empty folders persist across sessions).
 * Returns the root node (path = "", name = "").
 */
export function buildFolderTree(notes: Note[], explicitFolders: string[]): FolderNode {
  // Collect all paths that need a node
  const allPaths = new Set<string>(explicitFolders.filter(Boolean))
  for (const note of notes) {
    if (!note.folder) continue
    // Ensure every ancestor segment exists
    const parts = note.folder.split('/')
    for (let i = 1; i <= parts.length; i++) {
      allPaths.add(parts.slice(0, i).join('/'))
    }
  }

  const root: FolderNode = { path: '', name: '', children: [], notes: [] }
  const nodeMap = new Map<string, FolderNode>([['', root]])

  // Process paths in sorted order so parents are always created before children
  for (const path of [...allPaths].sort()) {
    const parts = path.split('/')
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')
    const node: FolderNode = { path, name, children: [], notes: [] }
    nodeMap.set(path, node)
    const parent = nodeMap.get(parentPath) ?? root
    parent.children.push(node)
  }

  // Distribute notes into their folder nodes
  for (const note of notes) {
    const folderPath = note.folder ?? ''
    const node = nodeMap.get(folderPath) ?? root
    node.notes.push(note)
  }

  // Sort each level: folders alphabetically, notes by updatedAt desc
  function sortNode(node: FolderNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    node.notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    node.children.forEach(sortNode)
  }
  sortNode(root)

  return root
}

/** Total note count including all descendants. */
export function countNotes(node: FolderNode): number {
  return node.notes.length + node.children.reduce((s, c) => s + countNotes(c), 0)
}

/** Collect all folder paths present in the tree (excludes root ""). */
export function getAllFolderPaths(root: FolderNode): string[] {
  const paths: string[] = []
  function walk(node: FolderNode) {
    if (node.path) paths.push(node.path)
    node.children.forEach(walk)
  }
  walk(root)
  return paths
}

/** Filter the tree so only nodes matching the predicate (or containing matching notes) survive. */
export function filterTree(root: FolderNode, predicate: (note: Note) => boolean): FolderNode {
  function filterNode(node: FolderNode): FolderNode {
    const notes = node.notes.filter(predicate)
    const children = node.children.map(filterNode).filter(c => c.notes.length > 0 || c.children.length > 0)
    return { ...node, notes, children }
  }
  return filterNode(root)
}
