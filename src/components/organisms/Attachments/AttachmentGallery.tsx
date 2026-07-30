import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { useSortPref } from '../../../store/useSortStore'
import { resolveAttachment, kindFromName } from '../../../attachments/attachmentService'
import { formatBytes } from '../../../tiers/checks'
import { sortItems } from '../../../utils/sortItems'
import { EmptyState } from '../../molecules/EmptyState'
import { SortMenu } from '../../molecules/SortMenu'
import { Icon } from '../../../icons/Icon'
import { KIND_ICON } from '../../../utils/attachmentIcons'
import type { Attachment } from '../../../types'

/** Grid of all attachments, shown at /attachments when no file is selected. */
export function AttachmentGallery(): JSX.Element {
  const allAttachments = useAttachmentStore(s => s.attachments)
  const navigate = useNavigate()

  const sortPref = useSortPref('attachments')
  const attachments = useMemo(
    () => sortItems(allAttachments, sortPref, a => a.name),
    [allAttachments, sortPref],
  )

  if (attachments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon="paperclip"
          title="No attachments yet"
          description="Upload files from the sidebar, paste an image copied from anywhere, or drop images and PDFs into a note — they'll live here."
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-[11px] text-text3">
          {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
        </p>
        <SortMenu scope="attachments" variant="button" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {attachments.map(att => (
          <GalleryTile key={att.id} att={att} onOpen={() => navigate(`/attachments/${att.id}`)} />
        ))}
      </div>
    </div>
  )
}

function GalleryTile({ att, onOpen }: { att: Attachment; onOpen: () => void }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const kind = kindFromName(att.name)

  useEffect(() => {
    if (kind !== 'image') return
    let alive = true
    void resolveAttachment(att.id).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [att.id, kind])

  return (
    <button
      type="button"
      onClick={onOpen}
      title={att.name}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface2 text-left transition hover:border-accent/40"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-surface3">
        {kind === 'image' && url ? (
          <img src={url} alt={att.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Icon name={KIND_ICON[kind]} size={30} className="text-text3" />
        )}
      </div>
      <div className="min-w-0 px-2 py-1.5">
        <p className="truncate text-xs font-medium text-text group-hover:text-accent">{att.name}</p>
        <p className="text-[10px] text-text3">{formatBytes(att.size)}</p>
      </div>
    </button>
  )
}
