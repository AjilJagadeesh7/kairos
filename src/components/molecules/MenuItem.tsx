type MenuItemProps = { label: string; onClick: () => void; danger?: boolean }

export function MenuItem({ label, onClick, danger = false }: MenuItemProps): JSX.Element {
  return (
    <button
      className={`block w-full rounded px-3 py-1.5 text-left text-xs transition hover:bg-surface3 ${danger ? 'text-red-500 hover:text-red-400' : 'text-text'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
