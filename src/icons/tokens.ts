/**
 * All semantic icon tokens used in the app.
 * Named as kebab-case equivalents of their default Lucide icon names.
 * Plugins can override any of these via api.registerIconPack(partialPack).
 */
export type IconToken =
  | 'alert-triangle'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up-right'
  | 'bar-chart-2'
  | 'book-open'
  | 'brackets'
  | 'brain-circuit'
  | 'bug'
  | 'calendar'
  | 'calendar-days'
  | 'check'
  | 'check-circle-2'
  | 'check-square'
  | 'columns-2'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'circle'
  | 'clipboard-copy'
  | 'cloud'
  | 'cloud-off'
  | 'code-2'
  | 'copy'
  | 'corner-down-left'
  | 'crosshair'
  | 'download'
  | 'external-link'
  | 'eye'
  | 'file-down'
  | 'file-json'
  | 'file-text'
  | 'flask-conical'
  | 'folder'
  | 'folder-input'
  | 'folder-open'
  | 'folder-plus'
  | 'folder-sync'
  | 'git-fork'
  | 'git-merge'
  | 'globe'
  | 'graduation-cap'
  | 'grip-vertical'
  | 'hash'
  | 'history'
  | 'home'
  | 'image'
  | 'info'
  | 'keyboard'
  | 'layers'
  | 'layout-dashboard'
  | 'layout-list'
  | 'lightbulb'
  | 'link'
  | 'link-2'
  | 'list'
  | 'loader-2'
  | 'more-horizontal'
  | 'network'
  | 'palette'
  | 'panel-left-close'
  | 'panel-left-open'
  | 'panel-right-close'
  | 'panel-right-open'
  | 'pen-tool'
  | 'pencil'
  | 'pin'
  | 'plus'
  | 'puzzle'
  | 'redo-2'
  | 'refresh-cw'
  | 'rotate-ccw'
  | 'save'
  | 'scroll-text'
  | 'search'
  | 'send'
  | 'settings'
  | 'settings-2'
  | 'shield-check'
  | 'square-kanban'
  | 'sticky-note'
  | 'store'
  | 'tag'
  | 'trash-2'
  | 'type'
  | 'undo-2'
  | 'unlink'
  | 'users'
  | 'wifi-off'
  | 'x'
  | 'zap'

export interface IconProps {
  size?: number | string
  className?: string
  strokeWidth?: number | string
  color?: string
  style?: React.CSSProperties
  'aria-hidden'?: boolean | 'true' | 'false'
  'aria-label'?: string
}

export type IconComponent = React.ComponentType<IconProps>

// Plugin-supplied icons are SVG strings (inline <svg>…</svg>) or URLs.
// Builtin icons remain React components (Lucide).
export type IconSource = IconComponent | string

export type IconPack = Record<IconToken, IconSource>
