import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { buildAttachmentTree } from '../../../utils/attachmentTree'
import { AttachmentBranch } from './AttachmentTree'
import { AttachmentFileRow } from './AttachmentFileRow'
import { IconButton } from '../../atoms/IconButton'
import { SectionLabel } from '../../atoms/SectionLabel'
import { InlineEditInput } from '../../molecules/InlineEditInput'
import { EmptyState } from '../../molecules/EmptyState'
import { Icon } from '../../../icons/Icon'

/** Sidebar for the Attachments page: folder tree of all files, upload, and search. */
export function AttachmentSidebar({ onClose }: { onClose?: () => void }): JSX.Element {
  const { id: activeId } = useParams<{ id?: string }>()
  const attachments = useAttachmentStore(s => s.attachments)
  const folderList  = useAttachmentStore(s => s.folderList)
  const isLoaded    = useAttachmentStore(s => s.isLoaded)
  const importFiles = useAttachmentStore(s => s.importFiles)
  const createFolder = useAttachmentStore(s => s.createFolder)
  const moveToFolder = useAttachmentStore(s => s.moveToFolder)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [creatingRoot, setCreatingRoot] = useState(false)
  const [rootName, setRootName] = useState('')
  const [rootDragOver, setRootDragOver] = useState(false)

  const tree = useMemo(() => buildAttachmentTree(attachments, folderList), [attachments, folderList])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return attachments.filter(a => a.name.toLowerCase().includes(q))
  }, [query, attachments])

  const onPick = async (files: FileList | null) => {
    if (files) await importFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const commitRoot = () => {
    setCreatingRoot(false)
    const name = rootName.trim(); setRootName('')
    if (name) void createFolder(name)
  }

  const onRootDrop = (e: React.DragEvent) => {
    e.preventDefault(); setRootDragOver(false)
    const dropId = e.dataTransfer.getData('application/x-attachment-id')
    if (dropId) void moveToFolder(dropId, undefined)
  }

  return (
    <aside aria-label="Attachments sidebar" className="flex h-full w-full flex-col border-r border-border bg-surface2">
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-3">
        <SectionLabel className="flex-1">Attachments</SectionLabel>
        <IconButton icon="plus"         label="Upload files" size="xs" onClick={() => fileInputRef.current?.click()} />
        <IconButton icon="folder-plus"  label="New folder"   size="xs" onClick={() => setCreatingRoot(true)} />
        {onClose && <IconButton icon="x" label="Close sidebar" size="xs" onClick={onClose} className="xl:hidden" />}
      </div>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => void onPick(e.target.files)} />

      {/* Search */}
      <div className="border-b border-border px-3 py-3">
        <div className="relative">
          <Icon name="search" size={13} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-2xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-text2 placeholder:text-text3"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text3 hover:text-text">
              <Icon name="x" size={13} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        className={`min-h-0 flex-1 overflow-y-auto py-2 ${rootDragOver ? 'bg-accent/5' : ''}`}
        onDragOver={query ? undefined : e => { e.preventDefault(); setRootDragOver(true) }}
        onDragLeave={() => setRootDragOver(false)}
        onDrop={query ? undefined : onRootDrop}
      >
        {!isLoaded ? (
          <div className="flex items-center justify-center py-10 text-text3">
            <Icon name="loader-2" size={20} className="animate-spin" aria-label="Loading" />
          </div>
        ) : query ? (
          searchResults.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text3">No files match "{query}"</p>
          ) : (
            searchResults.map(att => <AttachmentFileRow key={att.id} att={att} depth={0} isActive={att.id === activeId} />)
          )
        ) : attachments.length === 0 && folderList.length === 0 ? (
          <EmptyState icon="paperclip" title="No files yet" description="Upload with the + button above." className="py-10" />
        ) : (
          <>
            {creatingRoot && (
              <div className="flex h-[26px] items-center px-2">
                <InlineEditInput value={rootName} onChange={setRootName} onCommit={commitRoot}
                  onCancel={() => { setCreatingRoot(false); setRootName('') }} placeholder="Folder name" className="w-full" />
              </div>
            )}
            {tree.children.map(child => (
              <AttachmentBranch key={child.path} node={child} depth={0} activeId={activeId} />
            ))}
            {tree.items.map(att => (
              <AttachmentFileRow key={att.id} att={att} depth={0} isActive={att.id === activeId} />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2.5">
        <p className="text-[11px] text-text3">{attachments.length} {attachments.length === 1 ? 'file' : 'files'}</p>
      </div>
    </aside>
  )
}
