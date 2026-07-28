import type { ThemeMode } from '../types/ui.types'

export interface ThemeEntry {
  id: ThemeMode
  label: string
  /**
   * Whether this theme is dark. Drives the `.dark` class on <html>, which is
   * what Tailwind's `dark:` variants key off — so a light variant of a themed
   * palette must set this to false or the app renders half-dark.
   */
  isDark: boolean
  /** CSS hex — bg chip */
  swatchBg: string
  /** CSS hex — accent chip */
  swatchAccent: string
}

/**
 * Single source of truth for all available themes.
 * To add a new theme:
 *  1. Add the id to ThemeMode in src/types/ui.types.ts
 *  2. Add an entry here (isDark decides the `.dark` class)
 *  3. Add :root[data-theme='<id>'] CSS variables in src/index.css
 *  4. Add the id to the `.milkdown` derived-editor selector list in src/index.css,
 *     plus an --crepe-color-inline-code accent
 *  5. Add its background hex to the pre-hydration map in index.html (and to
 *     DARK_THEMES there if it's dark) so the first paint doesn't flash
 */
export const THEME_REGISTRY: ThemeEntry[] = [
  // Neutral pair
  { id: 'light',           label: 'Light',           isDark: false, swatchBg: '#F8F6F2', swatchAccent: '#221E18' },
  { id: 'dark',            label: 'Dark',            isDark: true,  swatchBg: '#141414', swatchAccent: '#EEEEEE' },

  // Amethyst Haze — muted lavender, low glare
  { id: 'amethyst-light',  label: 'Amethyst Haze',   isDark: false, swatchBg: '#F7F4FB', swatchAccent: '#7C5CA8' },
  { id: 'amethyst-dark',   label: 'Amethyst Haze',   isDark: true,  swatchBg: '#16121C', swatchAccent: '#B392E0' },

  // Bubblegum — tweakcn palette, chunky outlines
  { id: 'bubblegum-light', label: 'Bubblegum',       isDark: false, swatchBg: '#F6E6EE', swatchAccent: '#D04F99' },
  { id: 'bubblegum-dark',  label: 'Bubblegum',       isDark: true,  swatchBg: '#12242E', swatchAccent: '#FBE2A7' },

  // Caffeine — coffee and cream
  { id: 'caffeine-light',  label: 'Caffeine',        isDark: false, swatchBg: '#F6F1E9', swatchAccent: '#8B5E34' },
  { id: 'caffeine-dark',   label: 'Caffeine',        isDark: true,  swatchBg: '#16110D', swatchAccent: '#C98F5B' },

  // Doom 64 — rust and blood
  { id: 'doom64-light',    label: 'Doom 64',         isDark: false, swatchBg: '#F2E9DF', swatchAccent: '#A93226' },
  { id: 'doom64-dark',     label: 'Doom 64',         isDark: true,  swatchBg: '#0C0806', swatchAccent: '#C0392B' },

  // Neo Brutalism — hard borders, high contrast
  { id: 'brutalism-light', label: 'Neo Brutalism',   isDark: false, swatchBg: '#FDFBF0', swatchAccent: '#FFD400' },
  { id: 'brutalism-dark',  label: 'Neo Brutalism',   isDark: true,  swatchBg: '#111111', swatchAccent: '#FFE500' },

  // Retro Arcade — cabinet art: amber, cyan, bold outlines
  { id: 'arcade-light',    label: 'Retro Arcade',    isDark: false, swatchBg: '#FFF6E5', swatchAccent: '#E4322B' },
  { id: 'arcade-dark',     label: 'Retro Arcade',    isDark: true,  swatchBg: '#0B0A1F', swatchAccent: '#FFC531' },

  // Dark-only classics
  { id: 'dracula',         label: 'Dracula',         isDark: true,  swatchBg: '#282a36', swatchAccent: '#ff79c6' },
  { id: 'nord',            label: 'Nord',            isDark: true,  swatchBg: '#2e3440', swatchAccent: '#88c0d0' },
  { id: 'catppuccin',      label: 'Catppuccin',      isDark: true,  swatchBg: '#1e1e2e', swatchAccent: '#cba6f7' },
  { id: 'cyberpunk',       label: 'Cyberpunk',       isDark: true,  swatchBg: '#020108', swatchAccent: '#FF1493' },
]

/** Ids that get the `.dark` class on <html>. */
export const DARK_THEME_IDS: ThemeMode[] = THEME_REGISTRY.filter(t => t.isDark).map(t => t.id)

export function isDarkTheme(id: ThemeMode): boolean {
  return THEME_REGISTRY.find(t => t.id === id)?.isDark ?? id !== 'light'
}

/** Themes split for pickers — a flat list of 16 is unreadable. */
export const LIGHT_THEMES: ThemeEntry[] = THEME_REGISTRY.filter(t => !t.isDark)
export const DARK_THEMES: ThemeEntry[] = THEME_REGISTRY.filter(t => t.isDark)
