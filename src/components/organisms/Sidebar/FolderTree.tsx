import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { IconToken } from '../../../icons/tokens'
import { usePaneStore } from '../../../store/usePaneStore'
import { useAppStore } from '../../../store/useAppStore'
import { useIconRules, resolveNoteIcon, resolveFolderIcon } from '../../../plugins/pluginContext'
import type { FolderNode } from '../../../utils/folderTree'
import type { Note, TagRecord } from '../../../types'
import { Icon } from '../../../icons/Icon'

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface DragState { noteId: string }

// ─── Indent guides ────────────────────────────────────────────────────────────

function IndentGuides({ depth }: { depth: number }) {
  if (depth === 0) return null
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-border/35"
          style={{ left: `${16 + i * 16}px` }}
        />
      ))}
    </>
  )
}

// ─── Folder context menu ──────────────────────────────────────────────────────

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
        { iconName: 'plus'        as IconToken, label: 'New note',       action: onNewNote,      danger: false },
        { iconName: 'folder-plus' as IconToken, label: 'New subfolder',  action: onNewSubfolder, danger: false },
        { iconName: 'pencil'      as IconToken, label: 'Rename',         action: onRename,       danger: false },
        { iconName: 'trash-2'     as IconToken, label: 'Delete folder',  action: onDelete,       danger: true  },
      ]).map(({ iconName, label, action, danger }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); action() }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-surface2 ${
            danger ? 'text-red-400' : 'text-text'
          }`}
        >
          <Icon name={iconName} size={13} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Note context menu ────────────────────────────────────────────────────────

interface NoteContextMenuProps {
  x: number
  y: number
  note: Note
  isPinned: boolean
  isCopied: boolean
  allFolderPaths: string[]
  onPin: () => void
  onCopyLink: () => void
  onOpenInNewTab: () => void
  onMove: (folder: string) => void
  onDelete: () => void
  onClose: () => void
}

function NoteContextMenu({
  x, y, note, isPinned, isCopied, allFolderPaths,
  onPin, onCopyLink, onOpenInNewTab, onMove, onDelete, onClose,
}: NoteContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [showMove, setShowMove] = useState(false)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const left = Math.min(x, window.innerWidth - 208)
  const top  = Math.min(y, window.innerHeight - 260)

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={e => e.preventDefault()}
      className="fixed z-[9999] min-w-[190px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      style={{ left, top }}
    >
      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onPin(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        <Icon name="pin" size={13} aria-hidden className={isPinned ? 'fill-accent text-accent' : ''} />
        {isPinned ? 'Unpin' : 'Pin'}
      </button>

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); setShowMove(v => !v) }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        <Icon name="folder-input" size={13} aria-hidden />
        Move to folder
        <Icon name="chevron-right" size={11} className="ml-auto text-text3" aria-hidden />
      </button>

      {showMove && (
        <div className="border-t border-border/50 max-h-40 overflow-y-auto">
          {[{ label: '/ (root)', value: '' }, ...allFolderPaths.map(p => ({ label: p, value: p }))]
            .filter(o => o.value !== (note.folder ?? ''))
            .map(o => (
              <button key={o.value} type="button" role="menuitem"
                onClick={e => { e.stopPropagation(); onMove(o.value); onClose() }}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-text2 transition hover:bg-surface2"
              >
                <Icon name="folder" size={11} aria-hidden />
                {o.label}
              </button>
            ))
          }
        </div>
      )}

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onCopyLink(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        {isCopied
          ? <Icon name="check" size={13} className="text-green-500" aria-hidden />
          : <Icon name="copy" size={13} aria-hidden />
        }
        Copy wikilink
      </button>

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onOpenInNewTab(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text transition hover:bg-surface2"
      >
        <Icon name="external-link" size={13} aria-hidden />
        Open in new tab
      </button>

      <div className="my-0.5 border-t border-border/50" />

      <button type="button" role="menuitem"
        onClick={e => { e.stopPropagation(); onDelete(); onClose() }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition hover:bg-surface2"
      >
        <Icon name="trash-2" size={13} aria-hidden />
        Delete
      </button>
    </div>,
    document.body,
  )
}

// ─── Single note row ──────────────────────────────────────────────────────────

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
  const label = note.title || 'Untitled note'
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const isPinned  = useAppStore(s => s.pinnedNoteIds.includes(note.id))
  const pinNote   = useAppStore(s => s.pinNote)
  const unpinNote = useAppStore(s => s.unpinNote)
  const iconRules = useIconRules()
  const iconRule  = resolveNoteIcon(note.title, note.tags, iconRules)

  function handleOpenInNewTab() {
    const { focusedPaneId, openInNewTab } = usePaneStore.getState()
    openInNewTab(focusedPaneId, `/notes/${note.id}`, note.title || 'Note')
    onOpen()
  }

  return (
    <>
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
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className={`group relative flex h-[26px] cursor-pointer select-none items-center gap-1.5 pr-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/50 ${
          isActive
            ? 'bg-accent/15 text-text'
            : 'text-text2 hover:bg-surface3 hover:text-text'
        }`}
      >
        <IndentGuides depth={depth} />

        {/* Fixed-width icon zone — aligns with folder icons */}
        <span className="relative flex w-5 shrink-0 items-center justify-center" aria-hidden style={iconRule?.color ? { color: iconRule.color } : undefined}>
          {iconRule
            ? <span className="text-[12px] leading-none">{iconRule.emoji}</span>
            : isPinned
              ? <Icon name="pin" size={11} className="text-accent" />
              : <Icon name="file-text" size={11} className={isActive ? 'text-accent/60' : 'text-text3'} />
          }
        </span>

        <span className="min-w-0 flex-1 truncate">{label}</span>
      </div>

      {ctxMenu && (
        <NoteContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          note={note}
          isPinned={isPinned}
          isCopied={isCopied}
          allFolderPaths={allFolderPaths}
          onPin={() => isPinned ? unpinNote(note.id) : pinNote(note.id)}
          onCopyLink={onCopyLink}
          onOpenInNewTab={handleOpenInNewTab}
          onMove={onMove}
          onDelete={onDelete}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
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
  const iconRules = useIconRules()
  const iconRule  = resolveFolderIcon(node.name, iconRules)

  const isOver = localDragOver || isDragOver

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

  return (
    <div>
      {/* Folder header row */}
      <div
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onDragEnter={e => { e.preventDefault(); dragCounter.current++; setLocalDragOver(true) }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setLocalDragOver(false) }}
        onDrop={e => {
          e.preventDefault(); dragCounter.current = 0; setLocalDragOver(false)
          const noteId = e.dataTransfer.getData('mindvault/noteId')
          if (noteId) onDrop(node.path)
        }}
        className={`group relative flex h-[26px] cursor-pointer select-none items-center gap-1 pr-1 text-[13px] font-medium transition-colors ${
          isOver ? 'bg-accent/20 ring-1 ring-inset ring-accent/30' : 'text-text hover:bg-surface3'
        }`}
      >
        <IndentGuides depth={depth} />

        {/* Toggle button: chevron + icon + name all in one hit target */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          {/* Fixed-width icon zone — same width as NoteRow icon zone so names align */}
          <span
            className="relative flex w-5 shrink-0 items-center justify-center"
            style={iconRule?.color ? { color: iconRule.color } : undefined}
            aria-hidden
          >
            {/* Chevron overlaps into the padding zone — doesn't push icon right */}
            <Icon name="chevron-right"
              size={16}
              className={`absolute -left-3.5 text-text3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
            />
            {iconRule
              ? <span className="text-[12px] leading-none">{iconRule.emoji}</span>
              : expanded
                ? <Icon name="folder-open" size={11} className="shrink-0 text-accent/80" />
                : <Icon name="folder" size={11} className="shrink-0 text-accent/80" />
            }
          </span>

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
              className="min-w-0 flex-1 rounded border border-accent bg-surface px-1 py-0 text-[12px] outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate font-medium text-[13px]">{node.name}</span>
          )}
        </button>

        {/* Hover actions */}
        <div className="absolute right-1 top-0 flex h-full items-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="New note"
            onClick={e => { e.stopPropagation(); onCreateNote(node.path) }}
            className="flex h-5 w-5 items-center justify-center rounded text-text3 transition hover:text-text"
          >
            <Icon name="plus" size={11} aria-hidden />
          </button>
          <div className="relative">
            <button
              type="button"
              title="Folder options"
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
              className="flex h-5 w-5 items-center justify-center rounded text-text3 transition hover:text-text"
            >
              <Icon name="more-horizontal" size={11} aria-hidden />
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
          {isCreatingChild && (
            <div style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }} className="flex h-[26px] items-center gap-1.5 pr-2">
              <Icon name="folder-plus" size={12} className="shrink-0 text-accent/70" aria-hidden />
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
                className="min-w-0 flex-1 rounded border border-accent bg-surface px-1.5 py-0 text-[12px] outline-none placeholder:text-text3"
              />
            </div>
          )}

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

          {node.notes.length === 0 && node.children.length === 0 && !isCreatingChild && (
            <p
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
              className="py-0.5 pr-2 text-[11px] italic text-text3/50"
            >
              Empty
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stateful wrapper for FolderRow ──────────────────────────────────────────

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
        className="min-w-0 flex-1 rounded border border-accent bg-surface px-1.5 py-0 text-[12px] outline-none placeholder:text-text3"
      />
    </div>
  )
}

// ─── Main FolderTree ──────────────────────────────────────────────────────────

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

      {/* ── Pinned section ─────────────────────────────────────────────────── */}
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

      {/* ── Drop zone + new folder input ───────────────────────────────────── */}
      <RootDropZone drag={drag} onDrop={() => handleDrop('')} />
      {creatingRootFolder && (
        <RootNewFolderInput
          onCommit={name => { onCreateFolder('', name); onCreatingRootFolderChange(false) }}
          onCancel={() => onCreatingRootFolderChange(false)}
        />
      )}

      {/* ── Top-level folders first ────────────────────────────────────────── */}
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

      {/* ── Root-level notes (loose files, after folders) ─────────────────── */}
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

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!hasContent && !creatingRootFolder && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="file-text" size={28} className="text-text3" aria-hidden />
          <p className="text-xs text-text3">No notes yet</p>
        </div>
      )}
    </div>
  )
}
