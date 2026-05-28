interface AppLogoProps {
  size?: number
  className?: string
}

export function AppLogo({ size = 32, className = '' }: AppLogoProps) {
  const radius = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.52)

  return (
    <div
      aria-label="Kairos"
      draggable={false}
      className={`shrink-0 select-none flex items-center justify-center bg-[rgb(var(--accent))] text-white font-black ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize,
        fontFamily: 'inherit',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
    >
      K
    </div>
  )
}
