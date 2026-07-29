import { useEffect, useMemo, useState } from 'react'
import { useTrashStore } from '../store/useTrashStore'
import { TrashToolbar } from '../components/organisms/Trash/TrashToolbar'
import { TrashRow } from '../components/organisms/Trash/TrashRow'
import { EmptyState } from '../components/molecules/EmptyState'
import type { TrashKind } from '../types'

/** Recycle bin for every content type — restore an item or purge it for good. */
export function TrashPage(): JSX.Element {
  const items     = useTrashStore(s => s.items)
  const isLoaded  = useTrashStore(s => s.isLoaded)
  const loadTrash = useTrashStore(s => s.loadTrash)
  const [filter, setFilter] = useState<TrashKind | 'all'>('all')

  useEffect(() => { void loadTrash() }, [loadTrash])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of items) map[item.kind] = (map[item.kind] ?? 0) + 1
    return map
  }, [items])

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter(i => i.kind === filter)),
    [items, filter],
  )

  return (
    <div className="flex h-full flex-col">
      <TrashToolbar filter={filter} onFilterChange={setFilter} counts={counts} total={items.length} />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {items.length === 0 ? (
          <EmptyState
            icon="trash-2"
            title={isLoaded ? 'The trash is empty' : 'Loading…'}
            description={isLoaded
              ? 'Notes, journal entries, boards, canvases, pen notes and attachments you delete are kept here so you can put them back.'
              : undefined}
            className="mt-16"
          />
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {visible.map(item => <TrashRow key={item.id} item={item} />)}
          </ul>
        )}
      </div>
    </div>
  )
}
