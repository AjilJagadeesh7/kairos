import { useRef, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore } from '../../../store/usePaneStore'
import { FeatureCard } from './OnboardingAtoms'
import { VaultSetupStep } from './VaultSetupStep'
import { AppLogo } from '../../atoms/AppLogo'
import { Icon } from '../../../icons/Icon'
import {
  SAMPLE_NOTE_1_TITLE, SAMPLE_NOTE_2_TITLE,
  SAMPLE_NOTE_2, makeSampleNote1,
} from './onboardingSampleNotes'

const TOTAL_STEPS = 5

export function OnboardingModal() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const setUserName        = useAppStore(s => s.setUserName)
  const completeOnboarding = useAppStore(s => s.completeOnboarding)

  async function finish() {
    if (name.trim()) setUserName(name.trim())
    const store = useAppStore.getState()
    await store.createNote({ title: SAMPLE_NOTE_2_TITLE, content: SAMPLE_NOTE_2 })
    const welcomeId = await store.createNote({ title: SAMPLE_NOTE_1_TITLE, content: makeSampleNote1() })
    completeOnboarding()
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, welcomeId ? `/notes/${welcomeId}` : '/notes')
  }

  function skip() {
    completeOnboarding()
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, '/notes')
  }

  const prev = () => setStep(s => Math.max(0, s - 1))
  const next = () => setStep(s => Math.min(TOTAL_STEPS - 1, s + 1))

  const navButtons = (showBack = true) => (
    <div className="flex gap-3">
      {showBack && (
        <button
          onClick={prev}
          className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]"
        >
          Back
        </button>
      )}
      <button
        onClick={next}
        className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98]"
      >
        Next <Icon name="arrow-right" size={15} />
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-t-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl sm:rounded-2xl"
        style={{ animation: 'onboard-modal-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both', maxHeight: '92svh', overflowY: 'auto' }}
      >
        {/* Header bar — progress dots + skip */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgb(var(--border))/0.5] bg-[rgb(var(--surface))] px-4 py-3">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-[rgb(var(--accent))]' : i < step ? 'w-1.5 bg-[rgb(var(--accent)/0.4)]' : 'w-1.5 bg-[rgb(var(--border))]'
                }`}
              />
            ))}
          </div>
          {step < TOTAL_STEPS - 1 && (
            <button
              type="button"
              onClick={skip}
              className="text-[11px] text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text-2))]"
            >
              Skip tour
            </button>
          )}
        </div>

        <div key={step} style={{ animation: 'onboard-step-in 0.28s ease both' }}>

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="px-5 pb-8 pt-8 text-center sm:px-8 sm:pt-10">
              <div className="mb-5 inline-flex items-center justify-center">
                <AppLogo size={60} />
              </div>
              <h1 className="mb-2 text-2xl font-black tracking-tight text-[rgb(var(--text))]">
                Welcome to Kairos
              </h1>
              <p className="mb-7 text-sm leading-relaxed text-[rgb(var(--text-2))]">
                Your notes, tasks, and ideas — all on your device. No accounts. No tracking. Nothing sent to the cloud.
              </p>
              <div className="mb-7 text-left">
                <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--text-2))]">
                  What should we call you? <span className="font-normal text-[rgb(var(--text-3))]">(optional)</span>
                </label>
                <input
                  ref={inputRef}
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') next() }}
                  placeholder="Your name…"
                  maxLength={40}
                  className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-sm text-[rgb(var(--text))] outline-none transition placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--accent)/0.6)] focus:ring-2 focus:ring-[rgb(var(--accent)/0.15)]"
                />
              </div>
              <button
                onClick={next}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3.5 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98]"
              >
                Get started <Icon name="arrow-right" size={16} />
              </button>
            </div>
          )}

          {/* Step 1 — Features */}
          {step === 1 && (
            <div className="px-5 pb-8 pt-8 sm:px-8">
              <h2 className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">
                {name.trim() ? `Everything you need, ${name.trim().split(' ')[0]}` : 'Everything in one place'}
              </h2>
              <p className="mb-5 text-center text-sm text-[rgb(var(--text-2))]">
                Works completely offline. No internet required.
              </p>
              <div className="mb-6 grid grid-cols-2 gap-2">
                <FeatureCard
                  iconName="book-open"
                  title="Notes"
                  desc="Markdown editor with wikilinks, tags, backlinks, and semantic search."
                />
                <FeatureCard
                  iconName="calendar-days"
                  title="Journal"
                  desc="Daily entries with a calendar view. Never lose a thought."
                />
                <FeatureCard
                  iconName="square-kanban"
                  title="Kanban"
                  desc="Task boards with drag-and-drop, priorities, and due dates."
                />
                <FeatureCard
                  iconName="pen-tool"
                  title="Canvas"
                  desc="Arrange notes, text, and web pages on an infinite visual board."
                />
                <FeatureCard
                  iconName="network"
                  title="Graph"
                  desc="See how your notes connect — automatically built from your links."
                />
                <FeatureCard
                  iconName="shield-check"
                  title="Private"
                  desc="No accounts, no telemetry. Your data never leaves your device."
                />
              </div>
              {navButtons()}
            </div>
          )}

          {/* Step 2 — Wikilinks */}
          {step === 2 && (
            <div className="px-5 pb-8 pt-8 sm:px-8">
              <h2 className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">
                Link your notes together
              </h2>
              <p className="mb-5 text-center text-sm text-[rgb(var(--text-2))]">
                Two simple syntaxes that turn notes into a knowledge base.
              </p>
              <div className="mb-5 flex flex-col gap-3">
                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="link-2" size={13} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">
                      Wikilinks — link between notes
                    </span>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Type <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5 font-mono text-[rgb(var(--accent))]">[[</code> anywhere to get an autocomplete list of your notes.
                  </p>
                  <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 font-mono text-xs">
                    <span className="text-[rgb(var(--text-3))]">See also </span>
                    <span className="rounded bg-[rgb(var(--accent)/0.12)] px-1 py-0.5 text-[rgb(var(--accent))]">[[Meeting Notes]]</span>
                    <span className="text-[rgb(var(--text-3))]"> and </span>
                    <span className="rounded bg-[rgb(var(--accent)/0.12)] px-1 py-0.5 text-[rgb(var(--accent))]">[[Project Plan]]</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="layers" size={13} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">
                      Transclusion — embed note content
                    </span>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Add <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5 font-mono text-[rgb(var(--accent))]">!</code> before brackets to embed another note's content live inside yours.
                  </p>
                  <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 font-mono text-xs">
                    <span className="text-[rgb(var(--text-3))]">Summary:</span>
                    <div className="mt-1.5 rounded-md border border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent)/0.05)] p-2">
                      <div className="mb-1 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
                        <span className="font-sans text-[10px] font-semibold text-[rgb(var(--accent))]">Weekly Review</span>
                      </div>
                      <p className="font-sans text-[10px] text-[rgb(var(--text-3))]">Shipped the kanban feature, fixed three bugs…</p>
                    </div>
                    <span className="mt-1 block text-[rgb(var(--text-3))]">
                      <span className="text-[rgb(var(--accent))]">!</span>[[Weekly Review]]
                    </span>
                  </div>
                </div>
              </div>
              {navButtons()}
            </div>
          )}

          {/* Step 3 — Canvas & Graph */}
          {step === 3 && (
            <div className="px-5 pb-8 pt-8 sm:px-8">
              <h2 className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">
                See the bigger picture
              </h2>
              <p className="mb-5 text-center text-sm text-[rgb(var(--text-2))]">
                Two views that go beyond text.
              </p>
              <div className="mb-5 flex flex-col gap-3">
                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="pen-tool" size={14} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">Canvas — infinite visual board</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Drop notes, free-form text, and web pages onto a canvas. Arrange ideas spatially and draw connections between them.
                  </p>
                  <div className="relative mt-3 h-20 overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                    <div className="absolute left-4 top-3 w-24 rounded-lg border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.08)] px-2 py-1.5">
                      <div className="mb-1 h-1.5 w-12 rounded bg-[rgb(var(--text-3)/0.4)]" />
                      <div className="h-1 w-16 rounded bg-[rgb(var(--text-3)/0.25)]" />
                    </div>
                    <svg className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
                      <line x1="106" y1="30" x2="148" y2="55" stroke="rgb(var(--accent))" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 2" />
                    </svg>
                    <div className="absolute right-6 top-8 w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 py-1.5">
                      <div className="mb-1 h-1.5 w-10 rounded bg-[rgb(var(--text-3)/0.4)]" />
                      <div className="h-1 w-14 rounded bg-[rgb(var(--text-3)/0.25)]" />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="network" size={14} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">Graph — your knowledge map</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Every note is a node. Links, shared tags, and semantic similarity become edges. The more you write, the richer the map.
                  </p>
                </div>
              </div>
              {navButtons()}
            </div>
          )}

          {/* Step 4 — Vault setup */}
          {step === 4 && <VaultSetupStep onBack={prev} onFinish={finish} />}

        </div>
      </div>
    </div>
  )
}
