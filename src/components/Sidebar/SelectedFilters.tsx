import type { TagRecord } from '../../types'

interface SelectedFiltersProps {
  selectedTagFilters: string[]
  tagMap: Map<string, TagRecord>
}

export function SelectedFilters({ selectedTagFilters, tagMap }: SelectedFiltersProps): JSX.Element {
  if (selectedTagFilters.length === 0) return <></>
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-text3">
      {selectedTagFilters.map(tagName => {
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
      })}
    </div>
  )
}
