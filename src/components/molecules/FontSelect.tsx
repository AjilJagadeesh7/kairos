import type { FontOption, FontWeight, FontSize } from '../../types'
import { SectionLabel } from '../atoms/SectionLabel'

interface FontDef {
  value: FontOption
  label: string
  family: string
  tag: string
  weights: FontWeight[]
}

const FONT_GROUPS: { heading: string; fonts: FontDef[] }[] = [
  {
    heading: 'Sans-serif',
    fonts: [
      { value: 'manrope', label: 'Manrope', family: 'Manrope', tag: 'modern',    weights: ['light', 'regular', 'medium'] },
      { value: 'inter',   label: 'Inter',   family: 'Inter',   tag: 'neutral',   weights: ['light', 'regular', 'medium'] },
      { value: 'roboto',  label: 'Roboto',  family: 'Roboto',  tag: 'clean',     weights: ['light', 'regular', 'medium'] },
      { value: 'ubuntu',  label: 'Ubuntu',  family: 'Ubuntu',  tag: 'rounded',   weights: ['light', 'regular', 'medium'] },
      { value: 'poppins', label: 'Poppins', family: 'Poppins', tag: 'geometric', weights: ['light', 'regular', 'medium'] },
    ],
  },
  {
    heading: 'Serif',
    fonts: [
      { value: 'lora',              label: 'Lora',              family: 'Lora',              tag: 'literary',  weights: ['regular', 'medium'] },
      { value: 'libre-baskerville', label: 'Libre Baskerville', family: 'Libre Baskerville', tag: 'classical', weights: ['regular'] },
      { value: 'playfair-display',  label: 'Playfair Display',  family: 'Playfair Display',  tag: 'editorial', weights: ['regular', 'medium'] },
    ],
  },
  {
    heading: 'Fancy',
    fonts: [
      { value: 'cormorant', label: 'Cormorant Garamond', family: 'Cormorant Garamond', tag: 'elegant', weights: ['light', 'regular', 'medium'] },
      { value: 'cinzel',    label: 'Cinzel',             family: 'Cinzel',             tag: 'regal',   weights: ['regular', 'medium'] },
    ],
  },
]

export const FONT_WEIGHTS: { value: FontWeight; label: string; numeric: number }[] = [
  { value: 'light',   label: 'Light',   numeric: 300 },
  { value: 'regular', label: 'Regular', numeric: 400 },
  { value: 'medium',  label: 'Medium',  numeric: 500 },
]

/** `px` mirrors FONT_SIZE_MAP in useAppStartup — the root font-size each option applies. */
export const FONT_SIZES: { value: FontSize; label: string; px: number }[] = [
  { value: 'small',   label: 'Small',   px: 14 },
  { value: 'default', label: 'Default', px: 16 },
  { value: 'large',   label: 'Large',   px: 18 },
  { value: 'xlarge',  label: 'Larger',  px: 20 },
]

function getAllFonts(): FontDef[] {
  return FONT_GROUPS.flatMap(g => g.fonts)
}

const PREVIEW = 'The quick brown fox'

interface FontSelectProps {
  value: FontOption
  weight: FontWeight
  size: FontSize
  onFontChange: (f: FontOption, fallbackWeight?: FontWeight) => void
  onWeightChange: (w: FontWeight) => void
  onSizeChange: (s: FontSize) => void
}

export function FontSelect({ value, weight, size, onFontChange, onWeightChange, onSizeChange }: FontSelectProps): JSX.Element {
  const selectedFont = getAllFonts().find(f => f.value === value)
  const availableWeights = selectedFont?.weights ?? ['regular']

  function handleFontClick(font: FontDef) {
    const isWeightAvailable = font.weights.includes(weight)
    if (isWeightAvailable) {
      onFontChange(font.value)
    } else {
      // Fallback: prefer 'regular', otherwise first available
      const fallback = font.weights.includes('regular') ? 'regular' : font.weights[0]
      onFontChange(font.value, fallback)
    }
  }

  return (
    <div className="space-y-5">
      {/* Font grid grouped by style */}
      {FONT_GROUPS.map(group => (
        <div key={group.heading}>
          <SectionLabel className="mb-2.5">{group.heading}</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {group.fonts.map(font => {
              const selected = font.value === value
              return (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => handleFontClick(font)}
                  className={`flex flex-col gap-1.5 rounded-xl border-2 px-3.5 py-3 text-left transition-all ${
                    selected
                      ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5'
                      : 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-3))]'
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-wider leading-none ${
                    selected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'
                  }`}>
                    {selected ? '✓ ' : ''}{font.label}
                  </span>
                  <p
                    className="mt-0.5 text-[15px] leading-snug text-[rgb(var(--text))]"
                    style={{ fontFamily: `'${font.family}', ui-sans-serif, ui-serif` }}
                  >
                    {PREVIEW}
                  </p>
                  <span className="text-[9px] text-[rgb(var(--text-3))] uppercase tracking-wider">
                    {font.tag}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Weight picker — only shown when the selected font has multiple weights */}
      {availableWeights.length > 1 && (
        <div>
          <SectionLabel className="mb-2.5">Weight</SectionLabel>
          <div className="flex gap-2.5">
            {FONT_WEIGHTS.map(w => {
              const available = availableWeights.includes(w.value)
              const selected  = weight === w.value && available
              return (
                <button
                  key={w.value}
                  type="button"
                  disabled={!available}
                  onClick={() => available && onWeightChange(w.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-5 py-3 transition-all ${
                    selected
                      ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5'
                      : available
                        ? 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-3))]'
                        : 'cursor-not-allowed border-[rgb(var(--border))] opacity-25'
                  }`}
                >
                  <span
                    className="text-2xl leading-none text-[rgb(var(--text))]"
                    style={{
                      fontFamily: selectedFont ? `'${selectedFont.family}', ui-sans-serif, ui-serif` : 'inherit',
                      fontWeight: w.numeric,
                    }}
                  >
                    Aa
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider ${
                    selected ? 'font-semibold text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'
                  }`}>
                    {w.label}
                  </span>
                  <span className="text-[9px] text-[rgb(var(--text-3))]">{w.numeric}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Size picker — sets the root font size, scaling text and spacing app-wide */}
      <div>
        <SectionLabel className="mb-2.5">Size</SectionLabel>
        <div className="flex flex-wrap gap-2.5">
          {FONT_SIZES.map(s => {
            const selected = size === s.value
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onSizeChange(s.value)}
                className={`flex flex-col items-center justify-end gap-1.5 rounded-xl border-2 px-5 py-3 transition-all ${
                  selected
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5'
                    : 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-3))]'
                }`}
              >
                <span
                  className="flex h-7 items-end leading-none text-[rgb(var(--text))]"
                  style={{
                    fontFamily: selectedFont ? `'${selectedFont.family}', ui-sans-serif, ui-serif` : 'inherit',
                    fontSize: `${s.px + 6}px`,
                  }}
                >
                  Aa
                </span>
                <span className={`text-[10px] uppercase tracking-wider ${
                  selected ? 'font-semibold text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'
                }`}>
                  {s.label}
                </span>
                <span className="text-[9px] text-[rgb(var(--text-3))]">{s.px}px</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
