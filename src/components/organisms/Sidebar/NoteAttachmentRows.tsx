import { useState } from 'react'
import { Icon } from '../../../icons/Icon'
import type { IconToken } from '../../../icons/tokens'
import { useAttachments } from '../../../hooks/useAttachments'
import { kindFromName, removeAttachment, resolveAttachment, attachmentRef } from '../../../attachments/attachmentService'
import { usePaneStore } from '../../../store/usePaneStore'
import { useAppStore } from '../../../store/useAppStore'
import { AttachmentContextMenu } from './AttachmentContextMenu'
import type { AttachmentKind, AttachmentOwner, AttachmentRecord } from '../../../types'

const KIND_ICON: Record<AttachmentKind, IconToken> = {
  image: 'image',
  video: 'film',
  audio: 'music',
  pdf: 'file-text',
  file: 'file-down',
}

interface Props {
  noteId: string
  depth: number
}

/** Attachment rows shown nested under a note in the sidebar tree. */
export function NoteAttachmentRows({ noteId, depth }: Props): JSX.Element {
  const owner: AttachmentOwner = { type: 'note', id: noteId }
  const { attachments } = useAttachments(owner)

  const path = (filename: string) => `/attachment/note/${noteId}/${encodeURIComponent(filename)}`

  // Single click replaces the focused pane's tab (same as clicking a note).
  const openHere = (filename: string) => {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, path(filename))
  }
  const openNewTab = (filename: string) => {
    const { focusedPaneId, openInNewTab } = usePaneStore.getState()
    openInNewTab(focusedPaneId, path(filename), filename)
  }
  const download = async (filename: string) => {
    const url = await resolveAttachment(owner, filename)
    if (!url) return
    const a = Object.assign(document.createElement('a'), { href: url, download: filename })
    a.click()
  }
  // Delete the attachment AND strip its links from every note that references it.
  const remove = async (record: AttachmentRecord) => {
    await useAppStore.getState().removeAttachmentRef(attachmentRef(owner, record.filename))
    await removeAttachment(owner, record)
  }

  return (
    <>
      {attachments.map((att) => (
        <AttachmentRow
          key={att.id}
          att={att}
          depth={depth}
          onOpen={() => openHere(att.filename)}
          onOpenNewTab={() => openNewTab(att.filename)}
          onDownload={() => void download(att.filename)}
          onRemove={() => void remove(att)}
        />
      ))}
    </>
  )
}

interface RowProps {
  att: AttachmentRecord
  depth: number
  onOpen: () => void
  onOpenNewTab: () => void
  onDownload: () => void
  onRemove: () => void
}

function AttachmentRow({ att, depth, onOpen, onOpenNewTab, onDownload, onRemove }: RowProps): JSX.Element {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        title={att.filename}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY }) }}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className="group relative flex h-[24px] cursor-pointer select-none items-center gap-1.5 pr-2 text-[12px] text-text3 transition-colors hover:bg-surface3 hover:text-text2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/50"
      >
        <span className="flex w-5 shrink-0 items-center justify-center" aria-hidden>
          <Icon name={KIND_ICON[kindFromName(att.filename)]} size={11} />
        </span>
        <span className="min-w-0 flex-1 truncate">{att.filename}</span>
        <button
          type="button"
          title="Remove"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-surface2 hover:text-text group-hover:opacity-100"
        >
          <Icon name="x" size={11} />
        </button>
      </div>

      {menu && (
        <AttachmentContextMenu
          x={menu.x}
          y={menu.y}
          onOpen={onOpen}
          onOpenNewTab={onOpenNewTab}
          onDownload={onDownload}
          onDelete={onRemove}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
