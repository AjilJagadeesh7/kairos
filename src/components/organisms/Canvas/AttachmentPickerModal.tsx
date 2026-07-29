import { useMemo, useRef, useState } from 'react'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { kindFromName } from '../../../attachments/attachmentService'
import { formatBytes } from '../../../tiers/checks'
import { Icon } from '../../../icons/Icon'
import { Button } from '../../atoms/Button'
import { ModalShell } from '../../molecules/ModalShell'
import { KIND_ICON } from '../../../utils/attachmentIcons'
import type { Attachment } from '../../../types'

interface AttachmentPickerModalProps {
  onPick: (attachment: Attachment) => void
  onClose: () => void
}

/** Pick a file from the attachments library — or upload one — to place on a canvas. */
export function AttachmentPickerModal({ onPick, onClose }: AttachmentPickerModalProps) {
  const attachments = useAttachmentStore(s => s.attachments)
  const importFiles = useAttachmentStore(s => s.importFiles)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? attachments.filter(a => a.name.toLowerCase().includes(q)) : attachments
  }, [attachments, query])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const added = await importFiles(files)
      if (added.length > 0) onPick(added[0])
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-[420px]" className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon name="search" size={14} className="text-text3" />
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search attachments…"
          className="flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text3" />
      </div>

      <div
        className={`max-h-[320px] overflow-y-auto py-1 transition-colors ${dragOver ? 'bg-accent/5' : ''}`}
        onDrop={e => { e.preventDefault(); setDragOver(false); void handleUpload(e.dataTransfer.files) }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
      >
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-text3">
            {attachments.length === 0 ? 'No attachments yet — upload one below' : 'No attachments found'}
          </p>
        ) : (
          filtered.slice(0, 60).map(att => (
            <button key={att.id} type="button" onClick={() => onPick(att)} title={att.name}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-text transition hover:bg-surface2">
              <Icon name={KIND_ICON[kindFromName(att.name)]} size={13} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">{att.name}</span>
              <span className="shrink-0 text-[11px] text-text3">{formatBytes(att.size)}</span>
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="truncate text-[11px] text-text3">Documents, images, video and audio</span>
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => { void handleUpload(e.target.files); e.target.value = '' }} />
        <Button variant="primary" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? 'Uploading…' : 'Upload file'}
        </Button>
      </div>
    </ModalShell>
  )
}
