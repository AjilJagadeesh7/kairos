import { useEffect, useState } from 'react'
import { isAttachmentRef, parseAttachmentRef, resolveAttachment } from '../attachments/attachmentService'

/**
 * Resolves a note's banner value to a loadable URL. New banners are stored as
 * `attachment://<id>` refs and resolved to a blob URL (works in any webview, no
 * asset protocol needed); plain http(s) URLs and legacy asset:// URLs pass through.
 */
export function useResolvedBanner(banner: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!banner || !isAttachmentRef(banner)) return
    const id = parseAttachmentRef(banner)
    if (!id) return
    let alive = true
    void resolveAttachment(id).then(u => { if (alive) setResolved(u ?? undefined) })
    return () => { alive = false }
  }, [banner])

  // Plain http(s)/legacy URLs pass through; attachment refs use the resolved blob URL.
  return isAttachmentRef(banner) ? resolved : banner
}
