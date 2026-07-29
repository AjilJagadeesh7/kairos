import { LIGHT_THEMES, DARK_THEMES } from '../../themes/registry'
import type { ThemeEntry } from '../../themes/registry'
import type { ThemeMode } from '../../types'

/** Two-tone chip previewing a theme's background and accent. */
export function ThemeSwatch({ bg, accent, size = 14 }: { bg: string; accent: string; size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 rounded-full border border-black/25 shadow-sm"
      style={{ background: bg, width: size, height: size }}
    >
      <span
        className="absolute bottom-0 right-0 rounded-full border border-black/25"
        style={{ background: accent, width: size * 0.55, height: size * 0.55 }}
      />
    </span>
  )
}

/**
 * The theme list, split into Light and Dark columns.
 *
 * Themed palettes ship in both variants, so a flat list repeats every label
 * ("Bubblegum", "Bubblegum"…) with nothing to tell them apart. Grouping makes
 * the variant the column header rather than a suffix on every row.
 */
export function ThemeOptionList({ value, onSelect, className = '' }: {
  value: ThemeMode
  onSelect: (t: ThemeMode) => void
  className?: string
}): JSX.Element {
  return (
    <div className={`grid grid-cols-2 gap-x-1 gap-y-0.5 ${className}`}>
      <ThemeColumn heading="Light" themes={LIGHT_THEMES} value={value} onSelect={onSelect} />
      <ThemeColumn heading="Dark"  themes={DARK_THEMES}  value={value} onSelect={onSelect} />
    </div>
  )
}

function ThemeColumn({ heading, themes, value, onSelect }: {
  heading: string
  themes: ThemeEntry[]
  value: ThemeMode
  onSelect: (t: ThemeMode) => void
}) {
  return (
    <div role="group" aria-label={`${heading} themes`} className="min-w-0">
      <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-text3">
        {heading}
      </p>
      {themes.map(theme => {
        const selected = theme.id === value
        return (
          <button
            key={theme.id}
            type="button"
            role="option"
            aria-selected={selected}
            title={`${theme.label} — ${heading}`}
            onClick={() => onSelect(theme.id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition ${
              selected
                ? 'bg-accent/15 font-semibold text-accent'
                : 'text-text2 hover:bg-surface3 hover:text-text'
            }`}
          >
            <ThemeSwatch bg={theme.swatchBg} accent={theme.swatchAccent} size={13} />
            <span className="min-w-0 flex-1 truncate">{theme.label}</span>
            {selected && <span aria-hidden className="shrink-0 text-[10px]">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
