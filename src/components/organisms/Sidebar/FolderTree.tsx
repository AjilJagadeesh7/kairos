import { useRef, useState } from 'react'
import { ConnectedFolderRow } from './FolderRow'
import { NoteRow } from './NoteRow'
import { NoteTreeItem } from './NoteTreeItem'
import { Icon } from '../../../icons/Icon'
import { InlineEditInput } from '../../molecules/InlineEditInput'
import { EmptyState } from '../../molecules/EmptyState'
import type { FolderNode } from '../../../utils/folderTree'
import type { Note, TagRecord } from '../../../types'
import type { DragState } from './FolderRow'

// ─── Root drop zone ───────────────────────────────────────────────────────────

function RootDropZone({ drag, onDrop }: { drag: DragState | null; onDrop: () => void }) {
  const [over, setOver] = useState(false)
  const counter = useRef(0)
  if (!drag) return null
  return (
    <div
      onDragEnter={e => { e.preventDefault(); counter.current++; setOver(true) }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragLeave={() => { counter.current--; if (counter.current === 0) setOver(false) }}
      onDrop={e => { e.preventDefault(); counter.current = 0; setOver(false); onDrop() }}
      className={`mx-2 mb-1 rounded border-2 border-dashed px-2 py-1 text-center text-[11px] transition-colors ${
        over ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text3'
      }`}
    >
      Drop here to move to root
    </div>
  )
}

// ─── Root new-folder input ────────────────────────────────────────────────────

function RootNewFolderInput({ onCommit, onCancel }: { onCommit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  function commit() {
    if (value.trim()) onCommit(value.trim())
    else onCancel()
  }
  return (
    <div className="flex h-[26px] items-center gap-1.5 px-2">
      <Icon name="folder-plus" size={12} className="shrink-0 text-accent/70" aria-hidden />
      <InlineEditInput
        value={value}
        onChange={setValue}
        onCommit={commit}
        onCancel={onCancel}
        placeholder="Folder name"
        className="min-w-0 flex-1 placeholder:text-text3"
      />
    </div>
  )
}

// ─── Main FolderTree ──────────────────────────────────────────────────────────

interface FolderTreeProps {
  root: FolderNode
  activeNoteId: string | undefined
  copiedId: string | null
  tagMap: Map<string, TagRecord>
  allFolderPaths: string[]
  pinnedNotes: Note[]
  creatingRootFolder: boolean
  onCreatingRootFolderChange: (v: boolean) => void
  onOpenNote: (noteId: string) => void
  onDeleteNote: (note: Note) => void
  onCopyLink: (note: Note) => void
  onMoveNote: (noteId: string, folder: string) => void
  onCreateNote: (folder: string) => void
  onCreateFolder: (parentPath: string, name: string) => void
  onRenameFolder: (oldPath: string, newPath: string) => void
  onDeleteFolder: (path: string) => void
}

export function FolderTree({
  root, activeNoteId, copiedId, tagMap, allFolderPaths, pinnedNotes,
  creatingRootFolder, onCreatingRootFolderChange,
  onOpenNote, onDeleteNote, onCopyLink, onMoveNote,
  onCreateNote, onCreateFolder, onRenameFolder, onDeleteFolder,
}: FolderTreeProps) {
  const [drag, setDrag] = useState<DragState | null>(null)

  function handleDrop(folder: string) {
    if (drag) { onMoveNote(drag.noteId, folder); setDrag(null) }
  }

  const hasContent = root.notes.length > 0 || root.children.length > 0

  return (
    <div className="select-none" onDragEnd={() => setDrag(null)}>

      {pinnedNotes.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-1.5 px-2 pb-0.5 pt-1">
            <Icon name="pin" size={9} className="fill-accent text-accent" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text3">Pinned</span>
          </div>
          <div className="mx-1 overflow-hidden rounded border border-accent/10 bg-accent/[0.04] py-0.5">
            {pinnedNotes.map(note => (
              <NoteRow
                key={`pinned-${note.id}`}
                note={note}
                isActive={activeNoteId === note.id}
                isCopied={copiedId === note.id}
                depth={0}
                allFolderPaths={allFolderPaths}
                onOpen={() => onOpenNote(note.id)}
                onDelete={() => onDeleteNote(note)}
                onCopyLink={() => onCopyLink(note)}
                onMove={folder => onMoveNote(note.id, folder)}
                onDragStart={noteId => setDrag({ noteId })}
              />
            ))}
          </div>
          <div className="mx-2 mt-1.5 border-t border-border/50" />
        </div>
      )}

      <RootDropZone drag={drag} onDrop={() => handleDrop('')} />
      {creatingRootFolder && (
        <RootNewFolderInput
          onCommit={name => { onCreateFolder('', name); onCreatingRootFolderChange(false) }}
          onCancel={() => onCreatingRootFolderChange(false)}
        />
      )}

      {root.children.map(child => (
        <ConnectedFolderRow
          key={child.path}
          node={child}
          depth={0}
          allFolderPaths={allFolderPaths}
          activeNoteId={activeNoteId}
          copiedId={copiedId}
          tagMap={tagMap}
          drag={drag}
          onDrop={handleDrop}
          onCreateNote={onCreateNote}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onOpenNote={onOpenNote}
          onDeleteNote={onDeleteNote}
          onCopyLink={onCopyLink}
          onMoveNote={onMoveNote}
          onDragStart={noteId => setDrag({ noteId })}
          onCreateFolder={onCreateFolder}
        />
      ))}

      {root.notes.map(note => (
        <NoteTreeItem
          key={note.id}
          note={note}
          isActive={activeNoteId === note.id}
          isCopied={copiedId === note.id}
          depth={0}
          allFolderPaths={allFolderPaths}
          onOpen={() => onOpenNote(note.id)}
          onDelete={() => onDeleteNote(note)}
          onCopyLink={() => onCopyLink(note)}
          onMove={folder => onMoveNote(note.id, folder)}
          onDragStart={noteId => setDrag({ noteId })}
        />
      ))}

      {!hasContent && !creatingRootFolder && (
        <EmptyState icon="file-text" title="No notes yet" className="py-10" />
      )}
    </div>
  )
}
