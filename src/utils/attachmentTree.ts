import type { Attachment } from '../types'

/** A folder node in the attachments tree. Mirrors utils/folderTree for notes. */
export interface AttachmentNode {
  path: string              // full path: "" = root, "Media", "Media/Receipts"
  name: string              // last segment only
  children: AttachmentNode[]
  items: Attachment[]       // attachments directly in this folder
}

/** Build a virtual folder tree from the flat attachment list + explicit folders. */
export function buildAttachmentTree(items: Attachment[], explicitFolders: string[]): AttachmentNode {
  const allPaths = new Set<string>(explicitFolders.filter(Boolean))
  for (const it of items) {
    if (!it.folder) continue
    const parts = it.folder.split('/')
    for (let i = 1; i <= parts.length; i++) allPaths.add(parts.slice(0, i).join('/'))
  }

  const root: AttachmentNode = { path: '', name: '', children: [], items: [] }
  const nodeMap = new Map<string, AttachmentNode>([['', root]])

  for (const path of [...allPaths].sort()) {
    const parts = path.split('/')
    const node: AttachmentNode = { path, name: parts[parts.length - 1], children: [], items: [] }
    nodeMap.set(path, node)
    ;(nodeMap.get(parts.slice(0, -1).join('/')) ?? root).children.push(node)
  }

  for (const it of items) (nodeMap.get(it.folder ?? '') ?? root).items.push(it)

  function sortNode(node: AttachmentNode) {
    node.children.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    node.items.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    node.children.forEach(sortNode)
  }
  sortNode(root)
  return root
}

/** All folder paths in the tree (excludes root ""). */
export function attachmentFolderPaths(root: AttachmentNode): string[] {
  const paths: string[] = []
  const walk = (n: AttachmentNode) => { if (n.path) paths.push(n.path); n.children.forEach(walk) }
  walk(root)
  return paths
}
