interface InlineEditInputProps {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  placeholder?: string
  className?: string
}

export function InlineEditInput({
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  className = '',
}: InlineEditInputProps): JSX.Element {
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit() }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel() }
      }}
      onClick={e => e.stopPropagation()}
      className={`rounded border border-accent bg-surface px-1.5 py-0 text-[12px] text-text outline-none ${className}`}
    />
  )
}
