import { useIcon } from './IconContext'
import type { IconToken, IconProps } from './tokens'

interface Props extends IconProps {
  name: IconToken
}

/**
 * Renders a named icon from the active icon pack.
 * The built-in pack uses Lucide React. Plugins can replace any icon
 * via api.registerIconPack({ 'icon-token': MyComponent }).
 *
 * Usage: <Icon name="file-text" size={16} className="text-text3" />
 */
export function Icon({ name, ...props }: Props) {
  const Component = useIcon(name)
  return <Component {...props} />
}
