import { useState } from 'react'
import { TagChip } from '../atoms/TagChip'
import type { TagRecord } from '../../types'

interface TagFiltersDropdownProps {
  allTags: TagRecord[]
  selectedTagFilters: string[]
  onTagFiltersChange: (tags: string[]) => void
}

export function TagFiltersDropdown({
  allTags,
  selectedTagFilters,
  onTagFiltersChange
}: TagFiltersDropdownProps): JSX.Element {
  const [tagSearch, setTagSearch] = useState('')

  const handleTagToggle = (tagName: string) => {
    onTagFiltersChange(
      selectedTagFilters.includes(tagName)
        ? selectedTagFilters.filter(t => t !== tagName)
        : [...selectedTagFilters, tagName]
    )
  }

  const handleClear = () => {
    onTagFiltersChange([])
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text3">Tag filter</p>
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-semibold text-accent hover:text-accent/80"
          >
            Clear
          </button>
        </div>
        <input
          value={tagSearch}
          onChange={(e) => setTagSearch(e.target.value)}
          placeholder="Search tags…"
          className="w-full rounded-md border border-border bg-surface px-2 py-2 text-xs text-text outline-none focus:border-accent placeholder:text-text3"
        />
        <div className="mt-3 flex max-h-32 flex-wrap gap-1 overflow-y-auto pb-1">
          {allTags
            .filter((tag) => tag.name.includes(tagSearch.toLowerCase()))
            .slice(0, 20)
            .map((tag) => (
              <TagChip
                key={tag.name}
                tag={tag}
                selected={selectedTagFilters.includes(tag.name)}
                onClick={() => handleTagToggle(tag.name)}
              />
            ))}
        </div>
      </div>
    </div>
  )
}
