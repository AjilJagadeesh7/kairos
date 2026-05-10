import { Pill } from '../ui/Pill'

type SearchMode = 'fulltext' | 'semantic'

interface SearchModePillsProps {
  searchMode: SearchMode
  onSearchModeChange: (mode: SearchMode) => void
}

export function SearchModePills({
  searchMode,
  onSearchModeChange
}: SearchModePillsProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      <Pill
        selected={searchMode === 'fulltext'}
        onClick={() => onSearchModeChange('fulltext')}
      >
        Full text
      </Pill>
      <Pill
        selected={searchMode === 'semantic'}
        onClick={() => onSearchModeChange('semantic')}
      >
        Semantic
      </Pill>
    </div>
  )
}