import type { TagRecord } from '../../types'

type StorageCategory = 'all' | 'memory' | 'local' | 'synced'

interface SelectedFiltersProps {
  selectedTagFilters: string[]
  storageCategory: StorageCategory
  tagMap: Map<string, TagRecord>
}

export function SelectedFilters({
  selectedTagFilters,
  storageCategory,
  tagMap
}: SelectedFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2 text-[11px] text-text3">
      {selectedTagFilters.length > 0 ? (
        selectedTagFilters.map(tagName => {
          const tag = tagMap.get(tagName)
          return tag ? (
            <span
              key={tagName}
              className="rounded-full border border-border bg-surface3 px-2 py-0.5 text-[10px] text-text3"
              style={{ borderColor: tag.color + '40', backgroundColor: tag.color + '20' }}
            >
              #{tagName}
            </span>
          ) : null
        })
      ) : (
        <span className="rounded-full border border-border bg-surface3 px-2 py-0.5 text-[10px] text-text3">
          No tag filter
        </span>
      )}
      {storageCategory !== 'all' && (
        <span className="rounded-full border border-border bg-surface3 px-2 py-0.5 text-[10px] text-text3">
          {storageCategory === 'memory' ? 'Memory' : storageCategory === 'local' ? 'Local' : 'Synced'}
        </span>
      )}
    </div>
  )
}