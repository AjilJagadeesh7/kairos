import type { IconToken } from '../../../icons/tokens'
import type { TrashKind } from '../../../types'

/** Icons here match each content type's ActivityBar entry. */
export const TRASH_KIND_META: Record<TrashKind, { icon: IconToken; label: string }> = {
  note:       { icon: 'book-open',     label: 'Note'       },
  journal:    { icon: 'calendar-days', label: 'Journal'    },
  kanban:     { icon: 'square-kanban', label: 'Board'      },
  canvas:     { icon: 'pen-tool',      label: 'Canvas'     },
  pennote:    { icon: 'pen-line',      label: 'Pen note'   },
  attachment: { icon: 'paperclip',     label: 'Attachment' },
}

export const TRASH_KIND_ORDER: TrashKind[] = ['note', 'journal', 'kanban', 'canvas', 'pennote', 'attachment']

/** Human phrase for the configured retention window. */
export function retentionLabel(days: number): string {
  if (days <= 0) return 'kept until you delete them'
  if (days === 1) return 'deleted after 1 day'
  return `deleted after ${days} days`
}

/** "in 3d" / "in 5h" / "today" — how long an item has left, or null if it never expires. */
export function timeUntil(expiry: Date | null): string | null {
  if (!expiry) return null
  const diff = expiry.getTime() - Date.now()
  if (diff <= 0) return 'due for purge'
  if (diff < 3_600_000) return `in ${Math.max(1, Math.floor(diff / 60_000))}m`
  if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`
  return `in ${Math.floor(diff / 86_400_000)}d`
}
