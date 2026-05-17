import { useRef, useState } from 'react'
import { BookOpen, Network, ShieldCheck, SquareKanban, ArrowRight, Check } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Notes',
    desc: 'Markdown editor with wikilinks, tags, backlinks, and semantic search.',
  },
  {
    icon: SquareKanban,
    title: 'Kanban',
    desc: 'Multi-board task management with drag-and-drop, priorities, and due dates.',
  },
  {
    icon: Network,
    title: 'Graph',
    desc: 'Force-directed knowledge graph that maps note connections visually.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    desc: 'No accounts, no telemetry. Everything stays on your device.',
  },
]

export function OnboardingModal() {
  const [step, setStep]   = useState(0)
  const [name, setName]   = useState('')
  const inputRef          = useRef<HTMLInputElement>(null)
  const setUserName       = useAppStore(s => s.setUserName)
  const completeOnboarding = useAppStore(s => s.completeOnboarding)

  function finish() {
    if (name.trim()) setUserName(name.trim())
    completeOnboarding()
  }

  function handleNameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') setStep(1)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl"
        style={{ animation: 'onboard-modal-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Progress dots */}
        <div className="absolute left-0 right-0 top-4 flex justify-center gap-1.5">
          {[0, 1].map(i => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-[rgb(var(--accent))]' : 'w-1.5 bg-[rgb(var(--border))]'
              }`}
            />
          ))}
        </div>

        {/* Step content — key triggers re-animation on step change */}
        <div key={step} style={{ animation: 'onboard-step-in 0.28s ease both' }}>
          {step === 0 && (
            <div className="px-8 pb-8 pt-12 text-center">
              <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.1)] p-4">
                <BookOpen size={32} className="text-[rgb(var(--accent))]" strokeWidth={1.5} />
              </div>

              <h1 className="mb-2 text-2xl font-black tracking-tight text-[rgb(var(--text))]">
                Welcome to MindVault
              </h1>
              <p className="mb-8 text-sm leading-relaxed text-[rgb(var(--text-2))]">
                Your private, local-first knowledge base. No cloud required, no accounts, no tracking.
              </p>

              <div className="mb-8 text-left">
                <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--text-2))]">
                  What should we call you? <span className="font-normal text-[rgb(var(--text-3))]">(optional)</span>
                </label>
                <input
                  ref={inputRef}
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleNameKey}
                  placeholder="Your name…"
                  maxLength={40}
                  className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-sm text-[rgb(var(--text))] outline-none transition placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--accent)/0.6)] focus:ring-2 focus:ring-[rgb(var(--accent)/0.15)]"
                />
              </div>

              <button
                onClick={() => setStep(1)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98]"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="px-8 pb-8 pt-12">
              <h2 className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">
                {name.trim() ? `Here's what awaits you, ${name.trim().split(' ')[0]}` : "Here's what you can do"}
              </h2>
              <p className="mb-6 text-center text-sm text-[rgb(var(--text-2))]">
                Everything works offline, on your device.
              </p>

              <div className="mb-8 grid grid-cols-2 gap-3">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4 transition hover:border-[rgb(var(--accent)/0.4)]"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
                        <Icon size={15} className="text-[rgb(var(--accent))]" />
                      </div>
                      <span className="text-sm font-semibold text-[rgb(var(--text))]">{title}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]"
                >
                  Back
                </button>
                <button
                  onClick={finish}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98]"
                >
                  <Check size={15} /> Get started
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
