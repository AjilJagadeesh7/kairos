import type { IconToken } from '../../../icons/tokens'
import { Icon } from '../../../icons/Icon'

export function FeatureCard({ iconName, title, desc }: { iconName: IconToken; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3.5 transition hover:border-[rgb(var(--accent)/0.4)]">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
          <Icon name={iconName} size={14} className="text-[rgb(var(--accent))]" />
        </div>
        <span className="text-sm font-semibold text-[rgb(var(--text))]">{title}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">{desc}</p>
    </div>
  )
}

export function InfoRow({ icon, text }: { icon: IconToken; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[rgb(var(--text-3))]">
      <Icon name={icon} size={11} className="shrink-0" />
      {text}
    </div>
  )
}
