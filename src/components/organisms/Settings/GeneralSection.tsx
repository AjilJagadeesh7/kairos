import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
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
  const userName      = useAppStore((s) => s.userName)
  const setUserName = useAppStore((s) => s.setUserName)

  const [nameInput, setNameInput] = useState(userName)
  const [nameSaved, setNameSaved] = useState(false)

  function handleNameSave() {
    setUserName(nameInput.trim())
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  function replayTour() {
    // Reset onboardingDone so the modal re-appears
    useAppStore.setState({ onboardingDone: false })
  }

  function handleThemeChange(t: Parameters<typeof setTheme>[0]) {
    setTheme(t)
  }

  function handleFontChange(f: FontOption, fallbackWeight?: FontWeight) {
    setFont(f)
    if (fallbackWeight) setFontWeight(fallbackWeight)
  }

  function handleWeightChange(w: FontWeight) {
    setFontWeight(w)
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Profile">
        <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
          Your name is only stored locally and used as a personalised greeting.
        </p>
        <div className="flex gap-2">
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNameSave()}
            placeholder="Your name (optional)"
            maxLength={40}
            className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none transition placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--accent)/0.6)]"
          />
          <button
            onClick={handleNameSave}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
              nameSaved
                ? 'bg-green-500/10 text-green-500'
                : 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))] hover:opacity-90'
            }`}
          >
            {nameSaved ? <><Check size={14} /> Saved</> : 'Save'}
          </button>
        </div>

        <div className="mt-3 border-t border-[rgb(var(--border))] pt-3">
          <button
            onClick={replayTour}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-xs text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--text))]"
          >
            <RotateCcw size={12} /> Replay welcome tour
          </button>
        </div>
      </SectionCard>

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
