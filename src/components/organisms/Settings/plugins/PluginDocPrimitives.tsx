import { useState } from 'react'
import type { IconToken } from '../../../../icons/tokens'
import { Icon } from '../../../../icons/Icon'

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3 font-mono text-xs leading-relaxed text-[rgb(var(--text-2))]">
      {children.trim()}
    </pre>
  )
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded bg-[rgb(var(--surface-2))] px-1.5 py-0.5 font-mono text-[11px] text-[rgb(var(--accent))]">
      {children}
    </code>
  )
}

export function Collapsible({ title, iconName, defaultOpen = false, children }: {
  title: string
  iconName: IconToken
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-[rgb(var(--border))]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-[rgb(var(--surface-2))]"
      >
        <Icon name={iconName} size={14} className="shrink-0 text-[rgb(var(--accent))]" />
        <span className="flex-1 text-sm font-medium text-[rgb(var(--text))]">{title}</span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[rgb(var(--border))] px-4 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

export function PropRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <InlineCode>{name}</InlineCode>
      <span className="text-[rgb(var(--text-3))]">{desc}</span>
    </div>
  )
}

export function CalloutNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[rgb(var(--accent))]/20 bg-[rgb(var(--accent))]/5 px-3 py-2.5">
      <Icon name="info" size={13} className="mt-px shrink-0 text-[rgb(var(--accent))]" />
      <p className="text-xs text-[rgb(var(--text-2))]">{children}</p>
    </div>
  )
}
