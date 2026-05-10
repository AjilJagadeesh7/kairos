import { Pill } from '../ui/Pill'

type StorageCategory = 'all' | 'memory' | 'local' | 'synced'

interface StoragePillsProps {
  storageCategory: StorageCategory
  categoryCounts: { all: number; memory: number; local: number; synced: number }
  onStorageCategoryChange: (category: StorageCategory) => void
}

export function StoragePills({
  storageCategory,
  categoryCounts,
  onStorageCategoryChange
}: StoragePillsProps): JSX.Element {
  return (
    <div className="sidebar-storage-grid mb-4 grid grid-cols-2 gap-2 text-[10px]">
      <Pill
        selected={storageCategory === 'all'}
        onClick={() => onStorageCategoryChange('all')}
      >
        All · {categoryCounts.all}
      </Pill>
      <Pill
        selected={storageCategory === 'memory'}
        onClick={() => onStorageCategoryChange('memory')}
      >
        Memory · {categoryCounts.memory}
      </Pill>
      <Pill
        selected={storageCategory === 'local'}
        onClick={() => onStorageCategoryChange('local')}
      >
        Local · {categoryCounts.local}
      </Pill>
      <Pill
        selected={storageCategory === 'synced'}
        onClick={() => onStorageCategoryChange('synced')}
      >
        Synced · {categoryCounts.synced}
      </Pill>
    </div>
  )
}