import { useState } from 'react'
import { isDesktop } from '../../../utils/platform'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { useResolvedBanner } from '../../../hooks/useResolvedBanner'
import { importFile } from '../../../attachments/attachmentService'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { Icon } from '../../../icons/Icon'
import type { Note } from '../../../types'

const IMG_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
}

interface Props {
  note: Note
  onUpdateFrontmatter: (fm: Record<string, unknown>) => void
}

export function EditorBannerArea({ note, onUpdateFrontmatter }: Props) {
  const isMobile = useIsMobile()
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue]         = useState('')

  const banner    = note.userFrontmatter?.banner as string | undefined
  const bannerUrl = useResolvedBanner(note.id, banner)

  // On mobile the cover image is hidden entirely — that vertical space is
  // reclaimed for the editor (no add-cover affordance, no banner render).
  if (isMobile) return null

  const bx = ((note.userFrontmatter?.banner_x as number) ?? 0.5) * 100
  const by = ((note.userFrontmatter?.banner_y as number) ?? 0.5) * 100

  const pickFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const path = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'] }],
      })
      if (!path || typeof path !== 'string') return
      // Copy the picked image into the note's attachments (blob + vault), then
      // reference it by attachment:// — renders via a blob URL and syncs.
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const bytes = await readFile(path)
      const name  = path.split(/[/\\]/).pop() ?? 'banner'
      const file  = new File([bytes as BlobPart], name, { type: IMG_MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/png' })
      const ref   = await importFile({ type: 'note', id: note.id }, file)
      if (ref) onUpdateFrontmatter({ ...note.userFrontmatter, banner: ref })
    } catch {
      // fallback to URL input if dialog/read fails
      setShowUrlInput(true)
    }
  }

  const handleAdd = () => {
    if (isDesktop()) { void pickFile() } else { setShowUrlInput(true) }
  }

  const commitUrl = () => {
    const url = urlValue.trim()
    if (url) onUpdateFrontmatter({ ...note.userFrontmatter, banner: url })
    setUrlValue('')
    setShowUrlInput(false)
  }

  const removeBanner = () => {
    const fm = { ...note.userFrontmatter }
    delete fm.banner
    delete fm.banner_x
    delete fm.banner_y
    onUpdateFrontmatter(fm)
  }

  if (banner) {
    return (
      <div className="mb-3 -mx-4 -mt-4 h-44 overflow-hidden relative group">
        <img
          src={bannerUrl}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: `${bx}% ${by}%` }}
        />
        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
          >
            Change
          </button>
          <button
            type="button"
            onClick={removeBanner}
            className="rounded-md bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
          >
            Remove
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 -mt-4 mb-2 px-4 pt-2">
      {showUrlInput ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
          <Icon name="image" size={13} className="shrink-0 text-text3" />
          <input
            autoFocus
            type="url"
            value={urlValue}
            onChange={e => setUrlValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitUrl(); if (e.key === 'Escape') { setShowUrlInput(false); setUrlValue('') } }}
            placeholder="Paste image URL…"
            className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text3"
          />
          <Button variant="submit" size="xs" className="shrink-0" onClick={commitUrl}>Add</Button>
          <IconButton icon="x" label="Cancel" size="xs" onClick={() => { setShowUrlInput(false); setUrlValue('') }} />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text3 opacity-30 transition-opacity hover:opacity-100 hover:bg-surface2 hover:text-text2"
        >
          <Icon name="image" size={12} />
          Add cover image
        </button>
      )}
    </div>
  )
}
