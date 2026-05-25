import type { ButtonHTMLAttributes } from 'react'
import { Icon } from '../../icons/Icon'
import type { IconToken } from '../../icons/tokens'

type Size = 'xs' | 'sm' | 'md'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconToken
  label: string
  size?: Size
  className?: string
  iconClassName?: string
}

const sizeMap: Record<Size, { btn: string; icon: number }> = {
  xs: { btn: 'h-6 w-6',  icon: 13 },
  sm: { btn: 'h-7 w-7',  icon: 15 },
  md: { btn: 'h-8 w-8',  icon: 16 },
}

export function IconButton({
  icon,
  label,
  size = 'sm',
  className = '',
  iconClassName = '',
  ...props
}: IconButtonProps): JSX.Element {
  const { btn, icon: iconSize } = sizeMap[size]
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex ${btn} shrink-0 items-center justify-center rounded-md text-text2 transition hover:bg-surface3 hover:text-text ${className}`}
      {...props}
    >
      <Icon name={icon} size={iconSize} aria-hidden className={iconClassName || undefined} />
    </button>
  )
}
