interface FieldProps {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  type?: string
  mono?: boolean
}

export function Field({
  label, placeholder, value, onChange, type = 'text', mono = false,
}: FieldProps): JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-3))]">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={`w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--text-2))] ${mono ? 'font-mono text-xs' : ''}`}
      />
    </label>
  )
}
