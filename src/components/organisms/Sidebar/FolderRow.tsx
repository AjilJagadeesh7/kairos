import { useRef, useState } from 'react'
import { useIconRules, resolveFolderIcon } from '../../../plugins/pluginContext'
import { FolderMenu } from './FolderMenu'
import { NoteRow } from './NoteRow'
import { Icon } from '../../../icons/Icon'
import type { FolderNode } from '../../../utils/folderTree'
import type { Note, TagRecord } from '../../../types'

interface DragState { noteId: string }

interface IndentGuidesProps { depth: number }

function IndentGuides({ depth }: IndentGuidesProps) {
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
  const isOver    = localDragOver || isDragOver

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

        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <span
            className="relative flex w-5 shrink-0 items-center justify-center"
            style={iconRule?.color ? { color: iconRule.color } : undefined}
            aria-hidden
          >
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
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{node.name}</span>
          )}
        </button>

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

export function ConnectedFolderRow(props: ConnectedFolderRowProps) {
  const [expanded,      setExpanded]      = useState(true)
  const [renaming,      setRenaming]      = useState(false)
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

export type { DragState }
