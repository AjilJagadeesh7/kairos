import { useAppStore } from '../../../store/useAppStore'
import { ThemeSelect } from '../../molecules/ThemeSelect'
import { FontSelect, FONT_WEIGHTS } from '../../molecules/FontSelect'
import { SectionCard } from '../../molecules/SectionCard'
import type { FontOption, FontWeight } from '../../../types'

export function GeneralSection() {
  const theme         = useAppStore((s) => s.theme)
  const setTheme      = useAppStore((s) => s.setTheme)
  const font          = useAppStore((s) => s.font)
  const setFont       = useAppStore((s) => s.setFont)
  const fontWeight    = useAppStore((s) => s.fontWeight)
  const setFontWeight = useAppStore((s) => s.setFontWeight)

  async function persist() {
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
  }

  async function handleThemeChange(t: Parameters<typeof setTheme>[0]) {
    setTheme(t)
    await persist()
  }

  async function handleFontChange(f: FontOption, fallbackWeight?: FontWeight) {
    setFont(f)
    if (fallbackWeight) setFontWeight(fallbackWeight)
    await persist()
  }

  async function handleWeightChange(w: FontWeight) {
    setFontWeight(w)
    await persist()
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[rgb(var(--text))]">Theme</p>
            <p className="text-xs text-[rgb(var(--text-3))]">Choose your preferred colour scheme</p>
          </div>
          <ThemeSelect value={theme} onChange={(t) => void handleThemeChange(t)} />
        </div>
      </SectionCard>

      <SectionCard title="Font">
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Choose the typeface and weight used throughout the app.
        </p>
        <FontSelect
          value={font}
          weight={fontWeight}
          onFontChange={(f, fallback) => void handleFontChange(f, fallback)}
          onWeightChange={(w) => void handleWeightChange(w)}
        />
      </SectionCard>
    </div>
  )
}
