/** A file (image/video/audio/pdf/other) stored as a first-class item, on par
 *  with a note or journal entry. Owns its id and name, and can be organized into
 *  folders. Notes/journals reference it by id via an `attachment://<id>` link. */
export interface Attachment {
  id: string                    // uuid — stable across rename/move
  name: string                  // filename, unique within its folder
  folder?: string               // vault-relative path: "Media/Receipts"; "" or undefined = root
  mime: string
  size: number
  blob: Blob
  createdAt: string
  updatedAt: string
  noSync?: boolean              // when true, stays local-only (never pushed to remotes)
}

/** Metadata-only view of an attachment (no blob) — used for the vault manifest
 *  and cloud-sync reconciliation. */
export type AttachmentMeta = Omit<Attachment, 'blob'>

/** Coarse media category derived from a filename, used to pick a renderer/icon. */
export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'file'
