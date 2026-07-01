import { useEffect, useState } from 'react'
import { isAttachmentRef, parseAttachmentRef, resolveAttachment } from '../attachments/attachmentService'

/**
 * Resolves a note's banner value to a loadable URL. New banners are stored as
 * `attachment://` refs and resolved to a blob URL (works in any webview, no asset
 * protocol needed); plain http(s) URLs and legacy asset:// URLs pass through.
 */
export function useResolvedBanner(noteId: string, banner: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!banner || !isAttachmentRef(banner)) return
    const parsed = parseAttachmentRef(banner)
    if (!parsed) return
    let alive = true
    void resolveAttachment({ type: 'note', id: noteId }, parsed.filename)
      .then(u => { if (alive) setResolved(u ?? undefined) })
    return () => { alive = false }
  }, [noteId, banner])

  // Plain http(s)/legacy URLs pass through; attachment refs use the resolved blob URL.
  return isAttachmentRef(banner) ? resolved : banner
}
