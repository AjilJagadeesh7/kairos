import { useEffect, useState } from 'react'
import { resolveAttachment, kindFromName, downloadAttachment } from '../../../attachments/attachmentService'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { formatBytes } from '../../../tiers/checks'
import { Icon } from '../../../icons/Icon'

/** Viewer/player for a single attachment, rendered in the Attachments page main area. */
export function AttachmentViewer({ id }: { id: string }): JSX.Element {
  const record = useAttachmentStore(s => s.attachments.find(a => a.id === id))
  const [url, setUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    void resolveAttachment(id).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [id])

  const name = record?.name ?? ''
  const kind = kindFromName(name)

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon name={kind === 'image' ? 'image' : 'paperclip'} size={13} className="shrink-0 text-text3" />
        <span className="min-w-0 truncate text-sm font-medium text-text">{name || 'Attachment'}</span>
        {record && <span className="shrink-0 text-xs text-text3">{formatBytes(record.size)}</span>}
        {record && (
          <button
            type="button"
            onClick={() => void downloadAttachment(record)}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-text3 transition hover:bg-surface2 hover:text-text"
            title="Download"
          >
            <Icon name="download" size={12} /> Download
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {url === undefined ? (
          <Icon name="loader-2" size={22} className="animate-spin text-text3" />
        ) : url === null ? (
          <div className="flex flex-col items-center gap-2 text-text3">
            <Icon name="alert-triangle" size={22} />
            <p className="text-sm">Attachment unavailable</p>
          </div>
        ) : (
          <Media kind={kind} url={url} name={name} />
        )}
      </div>
    </div>
  )
}

function Media({ kind, url, name }: { kind: ReturnType<typeof kindFromName>; url: string; name: string }): JSX.Element {
  if (kind === 'image') return <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
  if (kind === 'video') return <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg bg-black" />
  if (kind === 'audio') {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border border-border bg-surface2 p-8">
        <Icon name="music" size={40} className="text-accent/70" />
        <p className="max-w-full truncate text-sm text-text2">{name}</p>
        <audio src={url} controls autoPlay className="w-full" />
      </div>
    )
  }
  if (kind === 'pdf') return <iframe src={url} title={name} className="h-full w-full rounded-lg border-0 bg-white" />
  return (
    <a href={url} download={name} className="flex flex-col items-center gap-2 text-accent">
      <Icon name="file-down" size={32} />
      <span className="text-sm">Download {name}</span>
    </a>
  )
}
