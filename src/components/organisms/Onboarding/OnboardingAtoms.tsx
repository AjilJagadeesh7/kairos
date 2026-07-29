import type { ReactNode } from 'react'
import type { IconToken } from '../../../icons/tokens'
import { Icon } from '../../../icons/Icon'
import { Button } from '../../atoms/Button'

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

/**
 * Every step's heading. `id` is wired to the dialog's aria-labelledby so screen
 * readers announce the new step when it becomes active.
 */
export function StepHeading({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <>
      <h2 id={id} className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">
        {title}
      </h2>
      {subtitle && <p className="mb-5 text-center text-sm text-[rgb(var(--text-2))]">{subtitle}</p>}
    </>
  )
}

/** A titled card used by the linking and visual steps. */
export function ExplainerCard({ iconName, title, children }: {
  iconName: IconToken
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
          <Icon name={iconName} size={14} className="text-[rgb(var(--accent))]" />
        </div>
        <span className="text-sm font-semibold text-[rgb(var(--text))]">{title}</span>
      </div>
      {children}
    </div>
  )
}

/** Shared Back / Next footer. */
export function StepNav({ onBack, onNext, nextLabel = 'Next' }: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
}) {
  return (
    <div className="flex gap-3">
      {onBack && (
        <Button variant="hollow" size="lg" className="flex-1" onClick={onBack}>
          Back
        </Button>
      )}
      <Button variant="submit" size="lg" className="flex-[2]" onClick={onNext}>
        {nextLabel} <Icon name="arrow-right" size={15} />
      </Button>
    </div>
  )
}
