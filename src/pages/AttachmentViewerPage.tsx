import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { resolveAttachment, kindFromName } from '../attachments/attachmentService'
import { SidebarShell } from '../components/organisms/Sidebar/SidebarShell'
import { Icon } from '../icons/Icon'
import type { AttachmentOwnerType } from '../types'

/**
 * Viewer/player for a single attachment, opened from the sidebar. Renders inside
 * the notes layout shell (FILES sidebar + main area), so it behaves like a note.
 */
export function AttachmentViewerPage(): JSX.Element {
  const { ownerType, ownerId, filename: rawName } = useParams<{ ownerType: string; ownerId: string; filename: string }>()
  const filename = rawName ? decodeURIComponent(rawName) : ''
  const [url, setUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    const owner = { type: (ownerType ?? 'note') as AttachmentOwnerType, id: ownerId ?? '' }
    void resolveAttachment(owner, filename)
      .then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [ownerType, ownerId, filename])

  const kind = kindFromName(filename)

  return (
    <SidebarShell resetKeys={[ownerId, filename]}>
    <div className="flex h-full flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon name="paperclip" size={13} className="shrink-0 text-text3" />
        <span className="min-w-0 truncate text-sm font-medium text-text">{filename}</span>
        {url && (
          <a
            href={url}
            download={filename}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-text3 transition hover:bg-surface2 hover:text-text"
            title="Download"
          >
            <Icon name="download" size={12} /> Download
          </a>
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
          <Viewer kind={kind} url={url} filename={filename} />
        )}
      </div>
    </div>
    </SidebarShell>
  )
}

function Viewer({ kind, url, filename }: { kind: ReturnType<typeof kindFromName>; url: string; filename: string }): JSX.Element {
  if (kind === 'image') {
    return <img src={url} alt={filename} className="max-h-full max-w-full object-contain" />
  }
  if (kind === 'video') {
    return <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg bg-black" />
  }
  if (kind === 'audio') {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border border-border bg-surface2 p-8">
        <Icon name="music" size={40} className="text-accent/70" />
        <p className="max-w-full truncate text-sm text-text2">{filename}</p>
        <audio src={url} controls autoPlay className="w-full" />
      </div>
    )
  }
  if (kind === 'pdf') {
    return <iframe src={url} title={filename} className="h-full w-full rounded-lg border-0 bg-white" />
  }
  return (
    <a href={url} download={filename} className="flex flex-col items-center gap-2 text-accent">
      <Icon name="file-down" size={32} />
      <span className="text-sm">Download {filename}</span>
    </a>
  )
}
