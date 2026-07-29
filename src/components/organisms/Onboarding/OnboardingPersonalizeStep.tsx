import { useAppStore } from '../../../store/useAppStore'
import { THEME_REGISTRY } from '../../../themes/registry'
import { FONT_SIZES } from '../../molecules/FontSelect'
import { StepHeading, StepNav } from './OnboardingAtoms'
import { Icon } from '../../../icons/Icon'

interface PersonalizeStepProps {
  headingId: string
  firstName: string
  onBack: () => void
  onNext: () => void
}

/**
 * Theme + text size, applied live. Deliberately placed early: the rest of the
 * tour then renders in the look the user just picked, which is a far better
 * demo than a screenshot, and these are the two settings people change first.
 */
export function OnboardingPersonalizeStep({ headingId, firstName, onBack, onNext }: PersonalizeStepProps) {
  const theme       = useAppStore(s => s.theme)
  const setTheme    = useAppStore(s => s.setTheme)
  const fontSize    = useAppStore(s => s.fontSize)
  const setFontSize = useAppStore(s => s.setFontSize)

  return (
    <div className="px-5 pb-8 pt-8 sm:px-8">
      <StepHeading
        id={headingId}
        title={firstName ? `Make it yours, ${firstName}` : 'Make it yours'}
        subtitle="Pick a look — you can change both anytime in Settings."
      />

      <fieldset className="mb-5">
        <legend className="mb-2 text-xs font-semibold text-[rgb(var(--text-2))]">Theme</legend>
        <div className="grid grid-cols-3 gap-2">
          {THEME_REGISTRY.map(entry => {
            const selected = entry.id === theme
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(entry.id)}
                className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left transition ${
                  selected
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5'
                    : 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-3))]'
                }`}
              >
                <span
                  className="relative inline-block h-5 w-5 shrink-0 rounded-full border border-black/20"
                  style={{ background: entry.swatchBg }}
                >
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-black/20"
                    style={{ background: entry.swatchAccent }}
                  />
                </span>
                <span className={`min-w-0 truncate text-[11px] font-medium ${
                  selected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-2))]'
                }`}>
                  {entry.label}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-2 text-xs font-semibold text-[rgb(var(--text-2))]">Text size</legend>
        <div className="grid grid-cols-4 gap-2">
          {FONT_SIZES.map(size => {
            const selected = size.value === fontSize
            return (
              <button
                key={size.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setFontSize(size.value)}
                className={`flex flex-col items-center justify-end gap-1 rounded-xl border-2 px-2 py-2 transition ${
                  selected
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5'
                    : 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-3))]'
                }`}
              >
                <span
                  className="flex h-6 items-end leading-none text-[rgb(var(--text))]"
                  style={{ fontSize: `${size.px + 2}px` }}
                >
                  Aa
                </span>
                <span className={`text-[10px] ${selected ? 'font-semibold text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'}`}>
                  {size.label}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <p className="mb-5 flex items-center justify-center gap-1.5 text-[11px] text-[rgb(var(--text-3))]">
        <Icon name="palette" size={11} />
        Six themes and ten typefaces live in Settings → General.
      </p>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}
