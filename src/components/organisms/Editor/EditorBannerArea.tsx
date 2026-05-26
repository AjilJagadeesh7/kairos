import { useState } from 'react'
import { isDesktop } from '../../../utils/platform'
import { Icon } from '../../../icons/Icon'
import type { Note } from '../../../types'

interface Props {
  note: Note
  onUpdateFrontmatter: (fm: Record<string, unknown>) => void
}

export function EditorBannerArea({ note, onUpdateFrontmatter }: Props) {
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue]         = useState('')

  const banner = note.userFrontmatter?.banner as string | undefined
  const bx     = ((note.userFrontmatter?.banner_x as number) ?? 0.5) * 100
  const by     = ((note.userFrontmatter?.banner_y as number) ?? 0.5) * 100

  const pickFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const path = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'] }],
      })
      if (!path || typeof path !== 'string') return
      const { convertFileSrc } = await import('@tauri-apps/api/core')
      onUpdateFrontmatter({ ...note.userFrontmatter, banner: convertFileSrc(path) })
    } catch {
      // fallback to URL input if dialog fails
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
          src={banner}
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
          <button type="button" onClick={commitUrl} className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-xs text-accent hover:bg-accent/20">Add</button>
          <button type="button" onClick={() => { setShowUrlInput(false); setUrlValue('') }} className="text-text3 hover:text-text"><Icon name="x" size={12} /></button>
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
