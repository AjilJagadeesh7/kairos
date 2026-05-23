interface AppLogoProps {
  size?: number
  className?: string
}

export function AppLogo({ size = 32, className = '' }: AppLogoProps) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="MindVault"
      draggable={false}
      className={`shrink-0 select-none rounded-[${Math.round(size * 0.22)}px] ${className}`}
      style={{ borderRadius: Math.round(size * 0.22) }}
    />
  )
}
