import { Icon } from '../../icons/Icon'
import type { IconToken } from '../../icons/tokens'
import type { ProviderLocation } from '../../types'

const META: Record<ProviderLocation, { label: string; icon: IconToken; className: string }> = {
  'on-device':   { label: 'On-device',   icon: 'smartphone', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  'self-hosted': { label: 'Self-hosted', icon: 'server',     className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  'cloud':       { label: 'Cloud',       icon: 'cloud',      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
}

/** Where an AI request goes — shown on every provider entry and in the chat header. */
export function LocationBadge({ location, className = '' }: { location: ProviderLocation; className?: string }) {
  const m = META[location]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.className} ${className}`}>
      <Icon name={m.icon} size={10} />
      {m.label}
    </span>
  )
}
