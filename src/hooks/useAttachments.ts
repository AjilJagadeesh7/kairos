import { useEffect, useState, useCallback } from 'react'
import { listAttachments, ATTACHMENTS_CHANGED_EVENT } from '../attachments/attachmentService'
import type { AttachmentOwner, AttachmentRecord } from '../types'

/** Loads an owner's attachments and reloads when the set changes. */
export function useAttachments(owner: AttachmentOwner): {
  attachments: AttachmentRecord[]
  reload: () => void
} {
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([])

  const reload = useCallback(() => {
    void listAttachments(owner).then(setAttachments)
  }, [owner.type, owner.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload()
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<AttachmentOwner>).detail
      if (detail?.type === owner.type && detail?.id === owner.id) reload()
    }
    window.addEventListener(ATTACHMENTS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(ATTACHMENTS_CHANGED_EVENT, onChanged)
  }, [owner.type, owner.id, reload])

  return { attachments, reload }
}
