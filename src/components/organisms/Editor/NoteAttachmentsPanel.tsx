import { useState, useRef, useEffect } from 'react'
import { Icon } from '../../../icons/Icon'
import type { IconToken } from '../../../icons/tokens'
import { formatBytes } from '../../../tiers/checks'
import { useAttachments } from '../../../hooks/useAttachments'
import {
  importFile,
  removeAttachment,
  resolveAttachment,
  attachmentRef,
  requestInsertAttachment,
  kindFromName,
} from '../../../attachments/attachmentService'
import type { AttachmentKind, AttachmentOwner, AttachmentRecord } from '../../../types'

const KIND_ICON: Record<AttachmentKind, IconToken> = {
  image: 'image',
  video: 'film',
  audio: 'music',
  pdf: 'file-text',
  file: 'file-down',
}

interface Props {
  owner: AttachmentOwner
  className?: string
}

export function NoteAttachmentsPanel({ owner, className = '' }: Props): JSX.Element | null {
  const { attachments } = useAttachments(owner)
  const [collapsed, setCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onPick = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) await importFile(owner, file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Hidden until the note has at least one attachment OR the user expands it via
  // the Add affordance; an always-visible header keeps it discoverable.
  return (
    <section className={`mt-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text3 hover:text-text2"
        >
          <Icon name="paperclip" size={12} />
          Attachments
          {attachments.length > 0 && <span className="font-normal normal-case">({attachments.length})</span>}
          <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={12} />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Add file"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-text3 transition hover:bg-surface2 hover:text-[rgb(var(--accent))]"
        >
          <Icon name="plus" size={11} />
          Add
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={e => void onPick(e.target.files)}
        className="hidden"
      />

      {!collapsed && attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {attachments.map(att => (
            <AttachmentTile key={att.id} owner={owner} record={att} />
          ))}
        </div>
      )}
    </section>
  )
}

function AttachmentTile({ owner, record }: { owner: AttachmentOwner; record: AttachmentRecord }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const kind = kindFromName(record.filename)

  useEffect(() => {
    let alive = true
    void resolveAttachment(owner, record.filename).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [owner.type, owner.id, record.filename]) // eslint-disable-line react-hooks/exhaustive-deps

  const insert = () => requestInsertAttachment(owner, attachmentRef(owner, record.filename))
  const remove = () => void removeAttachment(owner, record)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface2">
      {kind === 'image' && url ? (
        <img src={url} alt={record.filename} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-text3">
          <Icon name={KIND_ICON[kind]} size={22} />
          <span className="px-1 text-center text-[9px] uppercase tracking-wide">{kind}</span>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 transition-colors group-hover:bg-black/45">
        <TileButton icon="corner-down-left" title="Insert into note" onClick={insert} />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-white/90 p-1.5 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
            title="Open"
          >
            <Icon name="external-link" size={12} className="text-black" />
          </a>
        )}
        {url && (
          <a
            href={url}
            download={record.filename}
            className="rounded-md bg-white/90 p-1.5 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
            title="Download"
          >
            <Icon name="download" size={12} className="text-black" />
          </a>
        )}
        <TileButton icon="trash-2" title="Remove" onClick={remove} />
      </div>

      <p className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
        {record.filename} · {formatBytes(record.size)}
      </p>
    </div>
  )
}

function TileButton({ icon, title, onClick }: { icon: IconToken; title: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-md bg-white/90 p-1.5 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
    >
      <Icon name={icon} size={12} className="text-black" />
    </button>
  )
}
