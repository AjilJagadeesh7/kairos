export type AttachmentOwnerType = 'note' | 'journal'

/** A media file (image/video/audio/pdf/other) imported into a note or journal. */
export interface AttachmentRecord {
  id: string                    // uuid
  ownerType: AttachmentOwnerType
  ownerId: string               // noteId or journal date
  filename: string              // unique within the owner
  mime: string
  size: number
  blob: Blob
  createdAt: string
}

/** Identifies the note/journal an attachment belongs to. */
export interface AttachmentOwner {
  type: AttachmentOwnerType
  id: string
}

/** Coarse media category derived from a filename, used to pick a renderer/icon. */
export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'file'
