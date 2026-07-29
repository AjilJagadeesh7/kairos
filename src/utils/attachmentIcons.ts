import type { IconToken } from '../icons/tokens'
import type { AttachmentKind } from '../types'

/** Icon shown for each attachment kind, wherever a file is listed or embedded. */
export const KIND_ICON: Record<AttachmentKind, IconToken> = {
  image: 'image', video: 'film', audio: 'music', pdf: 'file-text', file: 'file-down',
}
