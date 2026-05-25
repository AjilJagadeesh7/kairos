import { useEffect, useRef } from 'react'
import { Icon } from '../../../icons/Icon'

interface FolderMenuProps {
  onNewNote: () => void
  onNewSubfolder: () => void
  onRename: () => void
  onDelete: () => void
  onClose: () => void
}

export function FolderMenu({ onNewNote, onNewSubfolder, onRename, onDelete, onClose }: FolderMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
    >
      {([
        { icon: 'plus'        as const, label: 'New note',      action: onNewNote,      danger: false },
        { icon: 'folder-plus' as const, label: 'New subfolder', action: onNewSubfolder, danger: false },
        { icon: 'pencil'      as const, label: 'Rename',        action: onRename,       danger: false },
        { icon: 'trash-2'     as const, label: 'Delete folder', action: onDelete,       danger: true  },
      ]).map(({ icon, label, action, danger }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); action() }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-surface2 ${
            danger ? 'text-red-400' : 'text-text'
          }`}
        >
          <Icon name={icon} size={13} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
