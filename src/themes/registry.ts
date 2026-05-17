import type { ThemeMode } from '../types/ui.types'

export interface ThemeEntry {
  id: ThemeMode
  label: string
  /** CSS hex — bg chip */
  swatchBg: string
  /** CSS hex — accent chip */
  swatchAccent: string
}

/**
 * Single source of truth for all available themes.
 * To add a new theme:
 *  1. Add the id to ThemeMode in src/types/ui.types.ts
 *  2. Add an entry here
 *  3. Add :root[data-theme='<id>'] CSS variables in src/index.css
 *  4. Add .milkdown overrides for the theme in src/index.css
 */
export const THEME_REGISTRY: ThemeEntry[] = [
  { id: 'light',      label: 'Light',      swatchBg: '#F8F6F2', swatchAccent: '#221E18' },
  { id: 'dark',       label: 'Dark',       swatchBg: '#141414', swatchAccent: '#EEEEEE' },
  { id: 'dracula',    label: 'Dracula',    swatchBg: '#282a36', swatchAccent: '#ff79c6' },
  { id: 'nord',       label: 'Nord',       swatchBg: '#2e3440', swatchAccent: '#88c0d0' },
  { id: 'catppuccin', label: 'Catppuccin', swatchBg: '#1e1e2e', swatchAccent: '#cba6f7' },
  { id: 'cyberpunk',  label: 'Cyberpunk',  swatchBg: '#020108', swatchAccent: '#FF1493' },
]
