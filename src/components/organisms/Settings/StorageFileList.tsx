import { useMemo } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { useStorageStore } from '../../../store/useStorageStore'
import { serializeNote } from '../../../adapters/storage/noteSerializer'
import { byteLength, formatBytes } from '../../../tiers/checks'
import { EmptyState } from '../../molecules/EmptyState'
import { IconButton } from '../../atoms/IconButton'
import { Icon } from '../../../icons/Icon'

const TOP_N = 15

export function StorageFileList(): JSX.Element {
  const notes        = useAppStore((s) => s.notes)
  const deleteNote   = useAppStore((s) => s.deleteNoteById)
  const confirm      = useConfirmStore((s) => s.confirm)
  const recalculate  = useStorageStore((s) => s.recalculate)

  const ranked = useMemo(() => {
    return notes
      .map((n) => ({ id: n.id, title: n.title || 'Untitled', size: byteLength(serializeNote(n)) }))
      .sort((a, b) => b.size - a.size)
      .slice(0, TOP_N)
  }, [notes])

  const onDelete = async (id: string, title: string) => {
    const ok = await confirm({ title: `Delete "${title}"?`, message: 'This permanently deletes the note and its history.', danger: true, confirmLabel: 'Delete' })
    if (!ok) return
    await deleteNote(id)
    void recalculate()
  }

  if (ranked.length === 0) {
    return <EmptyState icon="file-text" title="No notes yet" />
  }

  return (
    <div className="divide-y divide-[rgb(var(--border))]">
      {ranked.map((f) => (
        <div key={f.id} className="flex items-center gap-3 py-2">
          <Icon name="file-text" size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
          <span className="min-w-0 flex-1 truncate text-sm text-[rgb(var(--text))]">{f.title}</span>
          <span className="shrink-0 text-xs tabular-nums text-[rgb(var(--text-3))]">{formatBytes(f.size)}</span>
          <IconButton icon="trash-2" label={`Delete ${f.title}`} size="sm" onClick={() => void onDelete(f.id, f.title)} />
        </div>
      ))}
    </div>
  )
}
