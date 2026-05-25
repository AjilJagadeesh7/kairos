import { Icon } from '../../icons/Icon'
import type { IconToken } from '../../icons/tokens'
import { Button } from '../atoms/Button'

interface EmptyStateProps {
  icon: IconToken
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps): JSX.Element {
  return (
    <div className={`flex flex-col items-center gap-3 py-8 text-center ${className}`}>
      <Icon name={icon} size={28} className="text-text3" />
      <div>
        <p className="text-sm text-text2">{title}</p>
        {description && <p className="mt-0.5 text-xs text-text3">{description}</p>}
      </div>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}
