import { useIcon } from './IconContext'
import type { IconToken, IconProps } from './tokens'

interface Props extends IconProps {
  name: IconToken
}

/**
 * Renders a named icon from the active icon pack.
 * Builtin icons use Lucide React. Plugins can override any token with an SVG
 * string (inline <svg>…</svg>) or a URL via api.registerIconPack({ token: svgContent }).
 *
 * Usage: <Icon name="file-text" size={16} className="text-text3" />
 */
export function Icon({ name, size = 16, className, style, 'aria-hidden': ariaHidden, 'aria-label': ariaLabel, strokeWidth, color }: Props) {
  const source = useIcon(name)

  if (!source) return null

  if (typeof source !== 'string') {
    const Component = source
    return (
      <Component
        size={size}
        className={className}
        style={style}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        strokeWidth={strokeWidth}
        color={color}
      />
    )
  }

  const sizeVal = typeof size === 'number' ? `${size}px` : size

  if (source.trimStart().startsWith('<svg')) {
    return (
      <span
        className={className}
        style={{ display: 'inline-flex', width: sizeVal, height: sizeVal, flexShrink: 0, ...style }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG source comes from installed plugins, same trust level as plugin JS
        dangerouslySetInnerHTML={{ __html: source }}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
      />
    )
  }

  return (
    <img
      src={source}
      style={{ width: sizeVal, height: sizeVal, flexShrink: 0, ...style }}
      className={className}
      aria-hidden={ariaHidden}
      alt={ariaLabel ?? ''}
    />
  )
}
