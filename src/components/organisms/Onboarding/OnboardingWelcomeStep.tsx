import { AppLogo } from '../../atoms/AppLogo'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'

interface WelcomeStepProps {
  headingId: string
  name: string
  onNameChange: (name: string) => void
  onNext: () => void
}

export function OnboardingWelcomeStep({ headingId, name, onNameChange, onNext }: WelcomeStepProps) {
  return (
    <div className="px-5 pb-8 pt-8 text-center sm:px-8 sm:pt-10">
      <div className="mb-5 inline-flex items-center justify-center">
        <AppLogo size={60} />
      </div>
      <h1 id={headingId} className="mb-2 text-2xl font-black tracking-tight text-[rgb(var(--text))]">
        Welcome to Kairos
      </h1>
      <p className="mb-7 text-sm leading-relaxed text-[rgb(var(--text-2))]">
        Your notes, tasks, and ideas — all on your device. No accounts. No tracking. Nothing sent to the cloud.
      </p>

      <div className="mb-7 text-left">
        <label htmlFor="onboard-name" className="mb-1.5 block text-xs font-semibold text-[rgb(var(--text-2))]">
          What should we call you? <span className="font-normal text-[rgb(var(--text-3))]">(optional)</span>
        </label>
        <input
          id="onboard-name"
          autoFocus
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onNext() }}
          placeholder="Your name…"
          maxLength={40}
          className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-sm text-[rgb(var(--text))] outline-none transition placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--accent)/0.6)] focus:ring-2 focus:ring-[rgb(var(--accent)/0.15)]"
        />
        <p className="mt-1.5 text-[11px] text-[rgb(var(--text-3))]">
          Stored locally and only used to greet you on the home screen.
        </p>
      </div>

      <Button variant="submit" size="lg" fullWidth onClick={onNext}>
        Get started <Icon name="arrow-right" size={16} />
      </Button>
    </div>
  )
}
