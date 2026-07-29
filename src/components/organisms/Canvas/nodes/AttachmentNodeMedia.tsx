import { Icon } from '../../../../icons/Icon'
import type { AttachmentKind } from '../../../../types'

/**
 * Renderer for the body of an attachment node. `url` is an object URL for the
 * attachment blob — `undefined` while it resolves, `null` when the file can't
 * be found (deleted elsewhere, or not pulled to this device yet).
 */
export function AttachmentNodeMedia({ kind, url, name }: {
  kind: AttachmentKind
  url: string | null | undefined
  name: string
}) {
  if (url === undefined) {
    return <Icon name="loader-2" size={20} className="animate-spin text-[rgb(var(--text-3))]" />
  }

  if (url === null) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 text-center text-[rgb(var(--text-3))]">
        <Icon name="alert-triangle" size={22} />
        <p className="text-[11px]">Attachment unavailable</p>
      </div>
    )
  }

  if (kind === 'image') {
    return <img src={url} alt={name} className="h-full w-full object-contain" />
  }

  if (kind === 'video') {
    return <video src={url} controls className="h-full w-full bg-black object-contain" />
  }

  if (kind === 'audio') {
    return (
      <div className="flex w-full flex-col items-center gap-3 px-4">
        <Icon name="music" size={32} className="text-[rgb(var(--accent))]/70" />
        <audio src={url} controls className="w-full max-w-[320px]" />
      </div>
    )
  }

  if (kind === 'pdf') {
    return <iframe src={url} title={name} className="h-full w-full border-0 bg-white" />
  }

  return (
    <a href={url} download={name}
      className="flex flex-col items-center gap-2 px-4 text-center text-[rgb(var(--accent))]">
      <Icon name="file-down" size={28} />
      <span className="max-w-full truncate text-[11px]">Download {name}</span>
    </a>
  )
}
