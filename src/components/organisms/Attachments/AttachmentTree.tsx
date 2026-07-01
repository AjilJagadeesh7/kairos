import { useState } from 'react'
import { Icon } from '../../../icons/Icon'
import { InlineEditInput } from '../../molecules/InlineEditInput'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { AttachmentFileRow } from './AttachmentFileRow'
import type { AttachmentNode } from '../../../utils/attachmentTree'

interface BranchProps {
  node: AttachmentNode
  depth: number
  activeId?: string
}

/** One folder branch: header (expand / drop target / actions) + children + files. */
export function AttachmentBranch({ node, depth, activeId }: BranchProps): JSX.Element {
  const move        = useAttachmentStore(s => s.moveToFolder)
  const createFolder = useAttachmentStore(s => s.createFolder)
  const renameFolder = useAttachmentStore(s => s.renameFolder)
  const deleteFolder = useAttachmentStore(s => s.deleteFolder)

  const [expanded, setExpanded] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState(node.name)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const id = e.dataTransfer.getData('application/x-attachment-id')
    if (id) void move(id, node.path)
  }

  const commitCreate = () => {
    setCreating(false)
    const name = newName.trim(); setNewName('')
    if (name) void createFolder(`${node.path}/${name}`)
    if (name) setExpanded(true)
  }

  const commitRename = () => {
    setRenaming(false)
    const parent = node.path.split('/').slice(0, -1).join('/')
    const next = renameDraft.trim()
    if (next && next !== node.name) void renameFolder(node.path, parent ? `${parent}/${next}` : next)
  }

  const confirmDelete = () => {
    void useConfirmStore.getState()
      .confirm({ title: `Delete folder "${node.name}"?`, message: 'Files inside move to the root. This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .then(ok => { if (ok) void deleteFolder(node.path) })
  }

  return (
    <>
      {renaming ? (
        <div style={{ paddingLeft: `${8 + depth * 16}px` }} className="flex h-[26px] items-center pr-2">
          <InlineEditInput value={renameDraft} onChange={setRenameDraft} onCommit={commitRename}
            onCancel={() => { setRenaming(false); setRenameDraft(node.name) }} className="w-full" />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(v => !v)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v) } }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          className={`group relative flex h-[26px] cursor-pointer select-none items-center gap-1 pr-1 text-[13px] font-medium text-text transition-colors hover:bg-surface3 ${dragOver ? 'bg-accent/15 ring-1 ring-inset ring-accent/50' : ''}`}
        >
          <span className="relative flex w-5 shrink-0 items-center justify-center" aria-hidden>
            <Icon name="chevron-right" size={16} className={`absolute -left-3.5 text-text3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            <Icon name={expanded ? 'folder-open' : 'folder'} size={11} className="shrink-0 text-accent/80" />
          </span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" title="New subfolder" onClick={e => { e.stopPropagation(); setExpanded(true); setCreating(true) }} className="rounded p-0.5 text-text3 hover:bg-surface2 hover:text-text"><Icon name="folder-plus" size={12} /></button>
            <button type="button" title="Rename" onClick={e => { e.stopPropagation(); setRenameDraft(node.name); setRenaming(true) }} className="rounded p-0.5 text-text3 hover:bg-surface2 hover:text-text"><Icon name="pencil" size={12} /></button>
            <button type="button" title="Delete" onClick={e => { e.stopPropagation(); confirmDelete() }} className="rounded p-0.5 text-text3 hover:bg-surface2 hover:text-red-400"><Icon name="trash-2" size={12} /></button>
          </span>
        </div>
      )}

      {expanded && (
        <>
          {creating && (
            <div style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }} className="flex h-[26px] items-center pr-2">
              <InlineEditInput value={newName} onChange={setNewName} onCommit={commitCreate}
                onCancel={() => { setCreating(false); setNewName('') }} placeholder="Folder name" className="w-full" />
            </div>
          )}
          {node.children.map(child => (
            <AttachmentBranch key={child.path} node={child} depth={depth + 1} activeId={activeId} />
          ))}
          {node.items.map(att => (
            <AttachmentFileRow key={att.id} att={att} depth={depth + 1} isActive={att.id === activeId} />
          ))}
        </>
      )}
    </>
  )
}
