import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../icons/Icon'
import { KIND_ICON } from '../../../utils/attachmentIcons'
import { kindFromName, downloadAttachment } from '../../../attachments/attachmentService'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { useSelectionStore, useIsSelecting, useIsSelected } from '../../../store/useSelectionStore'
import { InlineEditInput } from '../../molecules/InlineEditInput'
import { Checkbox } from '../../atoms/Checkbox'
import { AttachmentContextMenu } from './AttachmentContextMenu'
import type { Attachment } from '../../../types'

interface Props {
  att: Attachment
  depth: number
  isActive: boolean
}

/** A single attachment row in the sidebar tree: click to view, drag to move, right-click for actions. */
export function AttachmentFileRow({ att, depth, isActive }: Props): JSX.Element {
  const navigate = useNavigate()
  const rename   = useAttachmentStore(s => s.renameAttachment)
  const remove   = useAttachmentStore(s => s.deleteAttachment)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(att.name)

  const isSelecting = useIsSelecting('attachments')
  const isSelected  = useIsSelected('attachments', att.id)
  const toggle      = useSelectionStore(s => s.toggle)

  const commitRename = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== att.name) void rename(att.id, draft.trim())
  }

  const confirmDelete = () => {
    void useConfirmStore.getState()
      .confirm({ title: `Delete "${att.name}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .then(ok => { if (ok) void remove(att.id) })
  }

  if (editing) {
    return (
      <div style={{ paddingLeft: `${8 + depth * 16}px` }} className="flex h-[26px] items-center pr-2">
        <InlineEditInput
          value={draft}
          onChange={setDraft}
          onCommit={commitRename}
          onCancel={() => { setEditing(false); setDraft(att.name) }}
          className="w-full"
        />
      </div>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        title={att.name}
        data-selected={isSelecting && isSelected ? 'true' : undefined}
        draggable={!isSelecting}
        onDragStart={e => { e.dataTransfer.setData('application/x-attachment-id', att.id); e.dataTransfer.effectAllowed = 'move' }}
        onClick={e => (isSelecting ? toggle(att.id, e.shiftKey) : navigate(`/attachments/${att.id}`))}
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          if (isSelecting) toggle(att.id, e.shiftKey)
          else navigate(`/attachments/${att.id}`)
        }}
        onContextMenu={e => {
          e.preventDefault(); e.stopPropagation()
          if (!isSelecting) setMenu({ x: e.clientX, y: e.clientY })
        }}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className={`group relative flex h-[26px] cursor-pointer select-none items-center gap-1.5 pr-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/50 ${
          isSelected ? 'bg-accent/20 text-text'
            : isActive ? 'bg-accent/10 text-accent'
            : 'text-text2 hover:bg-surface3 hover:text-text'
        }`}
      >
        <span className="flex w-5 shrink-0 items-center justify-center" aria-hidden={!isSelecting}>
          {isSelecting
            ? <Checkbox checked={isSelected} label={`Select "${att.name}"`} onChange={e => { e.stopPropagation(); toggle(att.id, e.shiftKey) }} />
            : <Icon name={KIND_ICON[kindFromName(att.name)]} size={12} />}
        </span>
        <span className="min-w-0 flex-1 truncate">{att.name}</span>
      </div>

      {menu && (
        <AttachmentContextMenu
          x={menu.x}
          y={menu.y}
          onOpen={() => navigate(`/attachments/${att.id}`)}
          onRename={() => { setDraft(att.name); setEditing(true) }}
          onDownload={() => void downloadAttachment(att)}
          onDelete={confirmDelete}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
