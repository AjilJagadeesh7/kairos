import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight, Folder, FolderOpen, FileText,
  Plus, FolderPlus, MoreHorizontal, Pencil, Trash2,
  Check, Copy, FolderInput, ExternalLink,
} from 'lucide-react'
import { useTabStore } from '../../../store/useTabStore'
import { timeAgo } from '../../../utils/timeAgo'
import { countNotes } from '../../../utils/folderTree'
import type { FolderNode } from '../../../utils/folderTree'
import type { Note, TagRecord } from '../../../types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FolderTreeProps {
  root: FolderNode
  activeNoteId: string | undefined
  copiedId: string | null
  tagMap: Map<string, TagRecord>
  allFolderPaths: string[]
  onOpenNote: (noteId: string) => void
  onDeleteNote: (note: Note) => void
  onCopyLink: (note: Note) => void
  onMoveNote: (noteId: string, folder: string) => void
  onCreateNote: (folder: string) => void
  onCreateFolder: (parentPath: string, name: string) => void
  onRenameFolder: (oldPath: string, newPath: string) => void
  onDeleteFolder: (path: string) => void
}

interface DragState {
  noteId: string
}

// ─── Folder context menu ─────────────────────────────────────────────────────

interface FolderMenuProps {
  onNewNote: () => void
  onNewSubfolder: () => void
  onRename: () => void
  onDelete: () => void
  onClose: () => void
}

function FolderMenu({ onNewNote, onNewSubfolder, onRename, onDelete, onClose }: FolderMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
    >
      {([
        { icon: Plus,         label: 'New note',       action: onNewNote,      danger: false },
        { icon: FolderPlus,   label: 'New subfolder',  action: onNewSubfolder, danger: false },
        { icon: Pencil,       label: 'Rename',         action: onRename,       danger: false },
        { icon: Trash2,       label: 'Delete folder',  action: onDelete,       danger: true  },
      ] as const).map(({ icon: Icon, label, action, danger }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); action() }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-surface2 ${
            danger ? 'text-red-400 hover:text-red-400' : 'text-text'
          }`}
        >
          <Icon size={13} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Move-to-folder popover ──────────────────────────────────────────────────

interface MovePopoverProps {
  allFolderPaths: string[]
  currentFolder: string | undefined
  onMove: (folder: string) => void
  onClose: () => void
}

function MovePopover({ allFolderPaths, currentFolder, onMove, onClose }: MovePopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const options = [
    { label: '/ (root)', value: '' },
    ...allFolderPaths.map(p => ({ label: p, value: p })),
  ].filter(o => o.value !== (currentFolder ?? ''))

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-0 top-full z-50 mt-1 max-h-48 min-w-[180px] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
    >
      {options.length === 0 ? (
        <p className="px-3 py-2 text-xs text-text3">No other folders</p>
      ) : (
        options.map(o => (
          <button
            key={o.value}
            type="button"
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); onMove(o.value); onClose() }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
          >
            <Folder size={12} aria-hidden />
            {o.label}
          </button>
        ))
      )}
    </div>
  )
}

// ─── Single note row ─────────────────────────────────────────────────────────

interface NoteRowProps {
  note: Note
  isActive: boolean
  isCopied: boolean
  depth: number
  allFolderPaths: string[]
  onOpen: () => void
  onDelete: () => void
  onCopyLink: () => void
  onMove: (folder: string) => void
  onDragStart: (noteId: string) => void
}

function NoteRow({
  note, isActive, isCopied, depth, allFolderPaths,
  onOpen, onDelete, onCopyLink, onMove, onDragStart,
}: NoteRowProps) {
  const openInNewTab = useTabStore(s => s.openInNewTab)

  function handleOpenInNewTab(e: React.MouseEvent) {
    e.stopPropagation()
    openInNewTab(`/notes/${note.id}`, note.title || 'Note')
    onOpen()
  }
  const label = note.title || 'Untitled note'
  const [showMove, setShowMove] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      data-note-item
      aria-label={label}
      aria-current={isActive ? 'true' : undefined}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('mindvault/noteId', note.id)
        onDragStart(note.id)
      }}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      className={`group relative flex cursor-pointer select-none items-center gap-1.5 rounded-md py-1.5 pr-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        isActive
          ? 'bg-accent/15 text-text font-medium'
          : 'text-text2 hover:bg-surface3 hover:text-text'
      }`}
    >
      <FileText size={13} className="shrink-0 text-text3" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] text-text3 opacity-0 group-hover:opacity-100">{timeAgo(note.updatedAt)}</span>

      {/* Hover action buttons */}
      <div className="relative flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title="Move to folder"
          aria-label="Move to folder"
          onClick={e => { e.stopPropagation(); setShowMove(v => !v) }}
          className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-text"
        >
          <FolderInput size={12} aria-hidden />
        </button>
        <button
          type="button"
          title="Copy wikilink"
          aria-label={`Copy link to "${label}"`}
          onClick={e => { e.stopPropagation(); onCopyLink() }}
          className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-text"
        >
          {isCopied
            ? <Check size={12} className="text-green-500" aria-hidden />
            : <Copy size={12} aria-hidden />}
        </button>
        <button
          type="button"
          title="Open in new tab"
          aria-label={`Open "${label}" in new tab`}
          onClick={handleOpenInNewTab}
          className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-text"
        >
          <ExternalLink size={12} aria-hidden />
        </button>
        <button
          type="button"
          title="Delete note"
          aria-label={`Delete "${label}"`}
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-red-400"
        >
          <Trash2 size={12} aria-hidden />
        </button>

        {showMove && (
          <MovePopover
            allFolderPaths={allFolderPaths}
            currentFolder={note.folder}
            onMove={onMove}
            onClose={() => setShowMove(false)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Single folder row ────────────────────────────────────────────────────────

interface FolderRowProps {
  node: FolderNode
  depth: number
  expanded: boolean
  isDragOver: boolean
  isRenaming: boolean
  isCreatingChild: boolean
  onStartRenaming: () => void
  allFolderPaths: string[]
  activeNoteId: string | undefined
  copiedId: string | null
  tagMap: Map<string, TagRecord>
  drag: DragState | null
  onToggle: () => void
  onDrop: (folder: string) => void
  onCreateNote: (folder: string) => void
  onRenameFolder: (oldPath: string, newPath: string) => void
  onDeleteFolder: (path: string) => void
  onStartCreatingChild: () => void
  onOpenNote: (noteId: string) => void
  onDeleteNote: (note: Note) => void
  onCopyLink: (note: Note) => void
  onMoveNote: (noteId: string, folder: string) => void
  onDragStart: (noteId: string) => void
  onCreateFolder: (parentPath: string, name: string) => void
  onFinishCreatingChild: () => void
  onFinishRenaming: () => void
}

function FolderRow({
  node, depth, expanded, isDragOver, isRenaming, isCreatingChild,
  allFolderPaths, activeNoteId, copiedId, tagMap, drag,
  onToggle, onDrop, onCreateNote, onRenameFolder, onDeleteFolder,
  onStartRenaming, onStartCreatingChild, onOpenNote, onDeleteNote, onCopyLink, onMoveNote,
  onDragStart, onCreateFolder, onFinishCreatingChild, onFinishRenaming,
}: FolderRowProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const [newFolderName, setNewFolderName] = useState('')
  const dragCounter = useRef(0)
  const [localDragOver, setLocalDragOver] = useState(false)

  const totalCount = countNotes(node)
  const Icon = expanded ? FolderOpen : Folder

  function commitRename() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) {
      const parentPath = node.path.split('/').slice(0, -1).join('/')
      const newPath = parentPath ? `${parentPath}/${trimmed}` : trimmed
      onRenameFolder(node.path, newPath)
    }
    onFinishRenaming()
  }

  function commitNewFolder() {
    const trimmed = newFolderName.trim()
    if (trimmed) onCreateFolder(node.path, trimmed)
    setNewFolderName('')
    onFinishCreatingChild()
  }

  const isOver = localDragOver || isDragOver

  return (
    <div>
      {/* Folder header row */}
      <div
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onDragEnter={e => {
          e.preventDefault()
          dragCounter.current++
          setLocalDragOver(true)
        }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDragLeave={() => {
          dragCounter.current--
          if (dragCounter.current === 0) setLocalDragOver(false)
        }}
        onDrop={e => {
          e.preventDefault()
          dragCounter.current = 0
          setLocalDragOver(false)
          const noteId = e.dataTransfer.getData('mindvault/noteId')
          if (noteId) onDrop(node.path)
        }}
        className={`group relative flex cursor-pointer select-none items-center gap-1.5 rounded-md py-1 pr-2 text-[12px] font-medium transition-colors ${
          isOver
            ? 'bg-accent/20 ring-1 ring-accent/40'
            : 'text-text hover:bg-surface3'
        }`}
      >
        {/* Expand / collapse chevron */}
        <button
          type="button"
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          onClick={e => { e.stopPropagation(); onToggle() }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text3 hover:text-text"
        >
          <ChevronRight
            size={12}
            aria-hidden
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Folder icon + name */}
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1.5"
        >
          <Icon size={13} className="shrink-0 text-accent/70" aria-hidden />
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onClick={e => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                if (e.key === 'Escape') { setRenameValue(node.name); onFinishRenaming() }
                e.stopPropagation()
              }}
              className="min-w-0 flex-1 rounded border border-accent bg-surface px-1 py-0.5 text-[12px] outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
          )}
        </button>

        {/* Note count badge */}
        {totalCount > 0 && (
          <span className="shrink-0 rounded-full bg-surface3 px-1.5 py-0.5 text-[10px] text-text3 opacity-60">
            {totalCount}
          </span>
        )}

        {/* Actions — hover only */}
        <div className="relative flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="New note in folder"
            aria-label="New note in folder"
            onClick={e => { e.stopPropagation(); onCreateNote(node.path) }}
            className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-text"
          >
            <Plus size={12} aria-hidden />
          </button>
          <div className="relative">
            <button
              type="button"
              title="Folder options"
              aria-label="Folder options"
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
              className="flex h-6 w-6 items-center justify-center rounded text-text3 transition hover:bg-surface hover:text-text"
            >
              <MoreHorizontal size={12} aria-hidden />
            </button>
            {showMenu && (
              <FolderMenu
                onNewNote={() => { setShowMenu(false); onCreateNote(node.path) }}
                onNewSubfolder={() => { setShowMenu(false); onStartCreatingChild() }}
                onRename={() => { setShowMenu(false); setRenameValue(node.name); onStartRenaming() }}
                onDelete={() => { setShowMenu(false); onDeleteFolder(node.path) }}
                onClose={() => setShowMenu(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Expanded children */}
      {expanded && (
        <div>
          {/* New subfolder input */}
          {isCreatingChild && (
            <div style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }} className="flex items-center gap-1.5 py-1 pr-2">
              <FolderPlus size={13} className="shrink-0 text-accent/70" aria-hidden />
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                onBlur={commitNewFolder}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitNewFolder() }
                  if (e.key === 'Escape') { setNewFolderName(''); onFinishCreatingChild() }
                }}
                className="min-w-0 flex-1 rounded border border-accent bg-surface px-1.5 py-0.5 text-[12px] outline-none placeholder:text-text3"
              />
            </div>
          )}

          {/* Subfolder nodes */}
          {node.children.map(child => (
            <ConnectedFolderRow
              key={child.path}
              node={child}
              depth={depth + 1}
              allFolderPaths={allFolderPaths}
              activeNoteId={activeNoteId}
              copiedId={copiedId}
              tagMap={tagMap}
              drag={drag}
              onDrop={onDrop}
              onCreateNote={onCreateNote}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onOpenNote={onOpenNote}
              onDeleteNote={onDeleteNote}
              onCopyLink={onCopyLink}
              onMoveNote={onMoveNote}
              onDragStart={onDragStart}
              onCreateFolder={onCreateFolder}
            />
          ))}

          {/* Notes in this folder */}
          {node.notes.map(note => (
            <NoteRow
              key={note.id}
              note={note}
              isActive={activeNoteId === note.id}
              isCopied={copiedId === note.id}
              depth={depth + 1}
              allFolderPaths={allFolderPaths}
              onOpen={() => onOpenNote(note.id)}
              onDelete={() => onDeleteNote(note)}
              onCopyLink={() => onCopyLink(note)}
              onMove={folder => onMoveNote(note.id, folder)}
              onDragStart={onDragStart}
            />
          ))}

          {/* Empty folder placeholder */}
          {node.notes.length === 0 && node.children.length === 0 && !isCreatingChild && (
            <p
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
              className="py-1 pr-2 text-[11px] italic text-text3"
            >
              Empty
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stateful wrapper for FolderRow (manages expand / rename / create-child) ──

interface ConnectedFolderRowProps {
  node: FolderNode
  depth: number
  allFolderPaths: string[]
  activeNoteId: string | undefined
  copiedId: string | null
  tagMap: Map<string, TagRecord>
  drag: DragState | null
  onDrop: (folder: string) => void
  onCreateNote: (folder: string) => void
  onRenameFolder: (oldPath: string, newPath: string) => void
  onDeleteFolder: (path: string) => void
  onOpenNote: (noteId: string) => void
  onDeleteNote: (note: Note) => void
  onCopyLink: (note: Note) => void
  onMoveNote: (noteId: string, folder: string) => void
  onDragStart: (noteId: string) => void
  onCreateFolder: (parentPath: string, name: string) => void
}

function ConnectedFolderRow(props: ConnectedFolderRowProps) {
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [creatingChild, setCreatingChild] = useState(false)

  return (
    <FolderRow
      {...props}
      expanded={expanded}
      isDragOver={false}
      isRenaming={renaming}
      isCreatingChild={creatingChild}
      onToggle={() => setExpanded(v => !v)}
      onStartRenaming={() => setRenaming(true)}
      onStartCreatingChild={() => { setExpanded(true); setCreatingChild(true) }}
      onFinishCreatingChild={() => setCreatingChild(false)}
      onFinishRenaming={() => setRenaming(false)}
      onRenameFolder={(old, next) => { props.onRenameFolder(old, next); setRenaming(false) }}
    />
  )
}

// ─── Root drop zone ───────────────────────────────────────────────────────────

interface RootDropZoneProps {
  drag: DragState | null
  onDrop: () => void
}

function RootDropZone({ drag, onDrop }: RootDropZoneProps) {
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

interface RootNewFolderInputProps {
  onCommit: (name: string) => void
  onCancel: () => void
}

function RootNewFolderInput({ onCommit, onCancel }: RootNewFolderInputProps) {
  const [value, setValue] = useState('')
  function commit() {
    if (value.trim()) onCommit(value.trim())
    else onCancel()
  }
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <FolderPlus size={13} className="shrink-0 text-accent/70" aria-hidden />
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Folder name"
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { onCancel() }
        }}
        className="min-w-0 flex-1 rounded border border-accent bg-surface px-1.5 py-0.5 text-[12px] outline-none placeholder:text-text3"
      />
    </div>
  )
}

// ─── Main FolderTree ──────────────────────────────────────────────────────────

export function FolderTree({
  root, activeNoteId, copiedId, tagMap, allFolderPaths,
  onOpenNote, onDeleteNote, onCopyLink, onMoveNote,
  onCreateNote, onCreateFolder, onRenameFolder, onDeleteFolder,
}: FolderTreeProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [creatingRootFolder, setCreatingRootFolder] = useState(false)

  function handleDrop(folder: string) {
    if (drag) {
      onMoveNote(drag.noteId, folder)
      setDrag(null)
    }
  }

  const hasContent = root.notes.length > 0 || root.children.length > 0

  return (
    <div
      className="select-none"
      onDragEnd={() => setDrag(null)}
    >
      {/* Root-level drop zone (move to root) */}
      <RootDropZone drag={drag} onDrop={() => handleDrop('')} />

      {/* New folder at root */}
      {creatingRootFolder && (
        <RootNewFolderInput
          onCommit={name => { onCreateFolder('', name); setCreatingRootFolder(false) }}
          onCancel={() => setCreatingRootFolder(false)}
        />
      )}

      {/* Root-level notes (no folder) */}
      {root.notes.map(note => (
        <NoteRow
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

      {/* Top-level folders */}
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

      {/* Empty state */}
      {!hasContent && !creatingRootFolder && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <FileText size={28} className="text-text3" aria-hidden />
          <p className="text-xs text-text3">No notes yet</p>
        </div>
      )}

      {/* New folder button at root level */}
      <button
        type="button"
        onClick={() => setCreatingRootFolder(true)}
        className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-text3 transition hover:bg-surface3 hover:text-text"
      >
        <FolderPlus size={12} aria-hidden />
        New folder
      </button>
    </div>
  )
}
