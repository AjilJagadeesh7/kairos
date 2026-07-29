import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore } from '../../../store/usePaneStore'
import { OnboardingWelcomeStep } from './OnboardingWelcomeStep'
import { OnboardingPersonalizeStep } from './OnboardingPersonalizeStep'
import { OnboardingFeaturesStep } from './OnboardingFeaturesStep'
import { OnboardingLinkingStep } from './OnboardingLinkingStep'
import { VaultSetupStep } from './VaultSetupStep'
import { Button } from '../../atoms/Button'
import {
  SAMPLE_NOTE_2_TITLE, SAMPLE_NOTE_2,
  SAMPLE_NOTE_1_TITLE, makeSampleNote1,
} from './onboardingSampleNotes'

const STEP_LABELS = ['Welcome', 'Personalise', 'Features', 'Linking', 'Your vault']
const TOTAL_STEPS = STEP_LABELS.length
const HEADING_ID = 'onboarding-heading'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function OnboardingModal() {
  const [step, setStep] = useState(0)
  // Prefilled so a replay shows the name you already set rather than a blank field.
  const [name, setName] = useState(() => useAppStore.getState().userName)
  const [goingBack, setGoingBack] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)
  /** Skip the focus shove on first paint so the name input keeps its autoFocus. */
  const firstPaint = useRef(true)

  const completeOnboarding   = useAppStore(s => s.completeOnboarding)
  const markOnboardingSeeded = useAppStore(s => s.markOnboardingSeeded)
  const setUserName          = useAppStore(s => s.setUserName)
  const alreadySeeded        = useAppStore(s => s.onboardingSeeded)

  const prev = useCallback(() => { setGoingBack(true);  setStep(s => Math.max(0, s - 1)) }, [])
  const next = useCallback(() => { setGoingBack(false); setStep(s => Math.min(TOTAL_STEPS - 1, s + 1)) }, [])

  const goTo = useCallback((target: number) => {
    setGoingBack(target < step)
    setStep(target)
  }, [step])

  /** Leave the tour. Replays close in place; a first run lands you in Notes. */
  const close = useCallback(() => {
    completeOnboarding()
    if (!alreadySeeded) {
      const { focusedPaneId, navigatePane } = usePaneStore.getState()
      navigatePane(focusedPaneId, '/notes')
    }
  }, [completeOnboarding, alreadySeeded])

  const finish = useCallback(async () => {
    if (name.trim()) setUserName(name.trim())

    // Sample notes are seeded once, ever — replaying the tour must not duplicate them.
    if (alreadySeeded) {
      completeOnboarding()
      return
    }

    const store = useAppStore.getState()
    await store.createNote({ title: SAMPLE_NOTE_2_TITLE, content: SAMPLE_NOTE_2 })
    const welcomeId = await store.createNote({
      title: SAMPLE_NOTE_1_TITLE,
      content: makeSampleNote1(name.trim().split(' ')[0]),
    })
    markOnboardingSeeded()
    completeOnboarding()

    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, welcomeId ? `/notes/${welcomeId}` : '/notes')
  }, [name, alreadySeeded, setUserName, markOnboardingSeeded, completeOnboarding])

  // Move focus into each new step so screen readers announce it and Tab starts
  // from the right place. The welcome input keeps its own autoFocus.
  useEffect(() => {
    if (firstPaint.current) { firstPaint.current = false; return }
    stepRef.current?.focus()
  }, [step])

  // Escape leaves the tour; ←/→ page through it unless a field has focus.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return }

      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if (typing) return

      if (e.key === 'ArrowRight' && step < TOTAL_STEPS - 1) { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft'  && step > 0)               { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, next, prev, close])

  // Keep Tab inside the dialog — it covers the whole screen, so anything behind
  // it is unreachable by pointer and should be unreachable by keyboard too.
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !cardRef.current) return
    const items = [...cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(el => el.getClientRects().length > 0)
    if (items.length === 0) return

    const first = items[0]
    const last  = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={HEADING_ID}
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        ref={cardRef}
        onKeyDown={trapTab}
        className="onboard-card relative w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-t-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: '92svh' }}
      >
        {/* Header — progress + skip */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgb(var(--border))/0.5] bg-[rgb(var(--surface))] px-4 py-3">
          <nav aria-label="Tour progress" className="flex gap-1.5">
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={`Step ${i + 1} of ${TOTAL_STEPS}: ${label}`}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => goTo(i)}
                className="group py-1.5"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 group-hover:bg-[rgb(var(--accent)/0.7)] ${
                    i === step  ? 'w-6 bg-[rgb(var(--accent))]'
                    : i < step  ? 'w-1.5 bg-[rgb(var(--accent)/0.4)]'
                    : 'w-1.5 bg-[rgb(var(--border))]'
                  }`}
                />
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-[11px] tabular-nums text-[rgb(var(--text-3))]">
              {step + 1}/{TOTAL_STEPS}
            </span>
            {step < TOTAL_STEPS - 1 && (
              <Button variant="link" size="xs" onClick={close}>Skip tour</Button>
            )}
          </div>
        </div>

        <div
          key={step}
          ref={stepRef}
          tabIndex={-1}
          className={`${goingBack ? 'onboard-step-back' : 'onboard-step'} outline-none`}
        >
          {step === 0 && (
            <OnboardingWelcomeStep
              headingId={HEADING_ID}
              name={name}
              onNameChange={setName}
              onNext={next}
            />
          )}
          {step === 1 && (
            <OnboardingPersonalizeStep
              headingId={HEADING_ID}
              firstName={name.trim().split(' ')[0] ?? ''}
              onBack={prev}
              onNext={next}
            />
          )}
          {step === 2 && <OnboardingFeaturesStep headingId={HEADING_ID} onBack={prev} onNext={next} />}
          {step === 3 && <OnboardingLinkingStep  headingId={HEADING_ID} onBack={prev} onNext={next} />}
          {step === 4 && <VaultSetupStep headingId={HEADING_ID} onBack={prev} onFinish={finish} />}
        </div>
      </div>
    </div>
  )
}
