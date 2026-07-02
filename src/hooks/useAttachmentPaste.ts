import { useEffect } from 'react'
import { useAttachmentStore } from '../store/useAttachmentStore'

/** Reasonable file extensions for the mime types the clipboard commonly hands us. */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
  'image/bmp': 'bmp', 'image/x-icon': 'ico',
}

function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? (mime.split('/')[1] || 'png').split('+')[0]
}

/** Name a clipboard blob that arrived without a filename (e.g. copied from a webpage). */
function nameForBlob(blob: Blob): string {
  return `pasted-image-${Date.now()}.${extForMime(blob.type)}`
}

/** Pull the first remote image URL out of a pasted HTML fragment or plain-text payload. */
function imageUrlFromClipboard(data: DataTransfer): string | null {
  const html = data.getData('text/html')
  if (html) {
    const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
    if (src && /^https?:\/\//i.test(src)) return src
  }
  const text = data.getData('text/plain').trim()
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?\S*)?$/i.test(text)) return text
  return null
}

/**
 * While mounted, imports images pasted onto the page as attachments — both raw
 * image bytes (copying an image itself) and remote image URLs (copying an image
 * address or an <img> from a webpage). Non-image pastes are left untouched so
 * text still pastes normally into inputs.
 */
export function useAttachmentPaste(folder?: string): void {
  const importFiles = useAttachmentStore(s => s.importFiles)

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const data = e.clipboardData
      if (!data) return

      // 1. Raw image bytes on the clipboard.
      const files = Array.from(data.items)
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((f): f is File => f !== null)
        .map(f => (f.name ? f : new File([f], nameForBlob(f), { type: f.type })))

      if (files.length > 0) {
        e.preventDefault()
        await importFiles(files, folder)
        return
      }

      // 2. A remote image URL — fetch the bytes, then import.
      const url = imageUrlFromClipboard(data)
      if (!url) return
      e.preventDefault()
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const blob = await res.blob()
        if (!blob.type.startsWith('image/')) return
        await importFiles([new File([blob], nameForBlob(blob), { type: blob.type })], folder)
      } catch {
        // Cross-origin/network failures are silent; the raw-bytes path covers most cases.
      }
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [importFiles, folder])
}
