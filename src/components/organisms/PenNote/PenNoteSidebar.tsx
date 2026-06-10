import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePenNoteStore } from '../../../store/usePenNoteStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { buildPenFolderTree, type PenFolderNode } from '../../../utils/penFolderTree'
import { InlineEditInput } from '../../molecules/InlineEditInput'
import { Icon } from '../../../icons/Icon'

type EditState =
  | { kind: 'new-folder'; parent: string }
  | { kind: 'rename'; path: string }
  | null

/** Stateful wrapper around the controlled InlineEditInput. */
function NameInput({ initial = '', placeholder, onCommit, onCancel }: {
  initial?: string; placeholder?: string; onCommit: (value: string) => void; onCancel: () => void
}): JSX.Element {
  const [v, setV] = useState(initial)
  return (
    <InlineEditInput value={v} onChange={setV} onCommit={() => onCommit(v)} onCancel={onCancel} placeholder={placeholder} />
  )
}

export function PenNoteSidebar(): JSX.Element {
  const { penNoteId } = useParams<{ penNoteId?: string }>()
  const navigate = useNavigate()
  const penNotes = usePenNoteStore(s => s.penNotes)
  const folders = usePenNoteStore(s => s.folders)
  const create = usePenNoteStore(s => s.create)
  const setFolder = usePenNoteStore(s => s.setFolder)
  const createFolder = usePenNoteStore(s => s.createFolder)
  const renameFolder = usePenNoteStore(s => s.renameFolder)
  const deleteFolder = usePenNoteStore(s => s.deleteFolder)

  const tree = useMemo(() => buildPenFolderTree(penNotes, folders), [penNotes, folders])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<EditState>(null)
  const dragId = useRef<string | null>(null)

  const toggle = (path: string) => setCollapsed(s => {
    const next = new Set(s)
    if (next.has(path)) next.delete(path); else next.add(path)
    return next
  })

  const newNote = (folder: string) => navigate(`/pennote/${create('Untitled pen note', { folder: folder || undefined })}`)

  const commitNewFolder = (parent: string, name: string) => {
    const path = parent ? `${parent}/${name}` : name
    createFolder(path)
    setCollapsed(s => { const n = new Set(s); n.delete(parent); return n })
    setEdit(null)
  }

  const handleDeleteFolder = (path: string) => {
    void useConfirmStore.getState().confirm({
      title: `Delete folder "${path.split('/').pop()}"?`,
      message: 'Pen notes inside move to the root. This cannot be undone.',
      confirmLabel: 'Delete', danger: true,
    }).then(ok => { if (ok) deleteFolder(path) })
  }

  const onDropTo = (folder: string) => {
    if (dragId.current) setFolder(dragId.current, folder)
    dragId.current = null
  }

  const renderFolder = (node: PenFolderNode, depth: number) => {
    const isCollapsed = collapsed.has(node.path)
    const pad = { paddingLeft: 8 + depth * 12 }
    return (
      <div key={node.path}>
        {edit?.kind === 'rename' && edit.path === node.path ? (
          <div style={pad} className="py-0.5 pr-2">
            <NameInput
              initial={node.name}
              onCommit={(v) => { if (v.trim()) renameFolder(node.path, node.path.split('/').slice(0, -1).concat(v.trim()).join('/')); setEdit(null) }}
              onCancel={() => setEdit(null)}
            />
          </div>
        ) : (
          <div
            style={pad}
            className="group flex h-7 items-center gap-1 pr-2 text-text2 transition hover:bg-surface3"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={e => { e.preventDefault(); onDropTo(node.path) }}
          >
            <button type="button" onClick={() => toggle(node.path)} className="flex items-center gap-1 min-w-0 flex-1 text-left">
              <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={12} className="shrink-0 text-text3" />
              <Icon name="folder-open" size={13} className="shrink-0 text-text3" />
              <span className="truncate text-xs font-medium">{node.name}</span>
            </button>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              <button type="button" title="New pen note here" onClick={() => newNote(node.path)} className="rounded p-0.5 hover:text-text"><Icon name="plus" size={12} /></button>
              <button type="button" title="New subfolder" onClick={() => { setEdit({ kind: 'new-folder', parent: node.path }); setCollapsed(s => { const n = new Set(s); n.delete(node.path); return n }) }} className="rounded p-0.5 hover:text-text"><Icon name="folder-plus" size={12} /></button>
              <button type="button" title="Rename" onClick={() => setEdit({ kind: 'rename', path: node.path })} className="rounded p-0.5 hover:text-text"><Icon name="pencil" size={11} /></button>
              <button type="button" title="Delete folder" onClick={() => handleDeleteFolder(node.path)} className="rounded p-0.5 hover:text-red-400"><Icon name="trash-2" size={11} /></button>
            </div>
          </div>
        )}

        {!isCollapsed && (
          <div>
            {node.children.map(c => renderFolder(c, depth + 1))}
            {edit?.kind === 'new-folder' && edit.parent === node.path && (
              <div style={{ paddingLeft: 8 + (depth + 1) * 12 }} className="py-0.5 pr-2">
                <NameInput placeholder="Folder name" onCommit={v => v.trim() ? commitNewFolder(node.path, v.trim()) : setEdit(null)} onCancel={() => setEdit(null)} />
              </div>
            )}
            {node.notes.map(n => renderNote(n.id, n.title, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderNote = (id: string, title: string, depth: number) => (
    <button
      key={id}
      type="button"
      draggable
      onDragStart={() => { dragId.current = id }}
      onClick={() => navigate(`/pennote/${id}`)}
      style={{ paddingLeft: 8 + depth * 12 + 14 }}
      className={`flex h-7 w-full items-center gap-2 pr-2 text-left text-sm transition ${id === penNoteId ? 'bg-accent/10 text-accent' : 'text-text2 hover:bg-surface3 hover:text-text'}`}
    >
      <Icon name="pen-line" size={13} className="shrink-0" />
      <span className="truncate">{title || 'Untitled pen note'}</span>
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between px-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-text3">Pen notes</span>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="New folder" title="New folder" onClick={() => setEdit({ kind: 'new-folder', parent: '' })}
            className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text">
            <Icon name="folder-plus" size={14} />
          </button>
          <button type="button" aria-label="New pen note" title="New pen note" onClick={() => newNote('')}
            className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text">
            <Icon name="plus" size={15} />
          </button>
        </div>
      </div>

      {/* Root drop zone + list */}
      <div
        className="min-h-0 flex-1 overflow-y-auto pb-2"
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={e => { e.preventDefault(); onDropTo('') }}
      >
        {tree.children.map(c => renderFolder(c, 0))}
        {edit?.kind === 'new-folder' && edit.parent === '' && (
          <div className="py-0.5 pl-2 pr-2">
            <NameInput placeholder="Folder name" onCommit={v => v.trim() ? commitNewFolder('', v.trim()) : setEdit(null)} onCancel={() => setEdit(null)} />
          </div>
        )}
        {tree.notes.map(n => renderNote(n.id, n.title, 0))}

        {penNotes.length === 0 && (
          <p className="px-3 py-2 text-xs italic text-text3">No pen notes yet.</p>
        )}
      </div>
    </div>
  )
}
