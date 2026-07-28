/** Content types that can be recovered from the trash. */
export type TrashKind = 'note' | 'journal' | 'kanban' | 'canvas' | 'pennote' | 'attachment'

/**
 * A soft-deleted item. `payload` holds the full serialized original (JSON for
 * every kind), so a restore never needs the vault file that was already removed.
 * Attachments additionally keep their binary in `blob` — their payload is only
 * the `AttachmentMeta`.
 */
export interface TrashItem {
  /** Trash record id — distinct from the original item's id. */
  id: string
  kind: TrashKind
  /** The original item's identifier (note id, journal date, board id…). */
  itemId: string
  /** Display name shown in the trash list. */
  title: string
  /** Secondary line — folder, item counts, etc. */
  subtitle?: string
  deletedAt: string
  payload: string
  blob?: Blob
}

/** A trash record before the service assigns its id and timestamp. */
export type NewTrashItem = Omit<TrashItem, 'id' | 'deletedAt'>

/**
 * How long items survive in the trash before the sweeper purges them.
 * `0` means keep forever (auto-purge disabled).
 */
export const TRASH_RETENTION_PRESETS: { days: number; label: string }[] = [
  { days: 0,  label: 'Forever' },
  { days: 1,  label: '1 day'   },
  { days: 7,  label: '7 days'  },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]
