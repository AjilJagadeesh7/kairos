import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  children: ReactNode
}

export function SectionCard({ title, children }: SectionCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="border-b border-[rgb(var(--border))] px-4 py-3">
        <h3 className="text-sm font-semibold text-[rgb(var(--text))]">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
