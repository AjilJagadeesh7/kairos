import { useShortcutKey } from '../../../hooks/useShortcutKey'
import { displayKey } from '../../../shortcuts/registry'
import { ExplainerCard, StepHeading, StepNav } from './OnboardingAtoms'
import { KbdKey } from '../../atoms/KbdKey'

interface LinkingStepProps {
  headingId: string
  onBack: () => void
  onNext: () => void
}

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5 font-mono text-[rgb(var(--accent))]">
      {children}
    </code>
  )
}

export function OnboardingLinkingStep({ headingId, onBack, onNext }: LinkingStepProps) {
  // Read the live binding so a remapped palette shortcut still reads correctly here.
  const paletteKey = useShortcutKey('command-palette')

  return (
    <div className="px-5 pb-8 pt-8 sm:px-8">
      <StepHeading
        id={headingId}
        title="Link your notes together"
        subtitle="Two simple syntaxes that turn notes into a knowledge base."
      />

      <div className="mb-4 flex flex-col gap-3">
        <ExplainerCard iconName="link-2" title="Wikilinks — link between notes">
          <p className="mb-3 text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
            Type <Code>[[</Code> anywhere to get an autocomplete list of your notes. Rename a
            note later and every link pointing to it updates itself.
          </p>
          <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 font-mono text-xs">
            <span className="text-[rgb(var(--text-3))]">See also </span>
            <span className="rounded bg-[rgb(var(--accent)/0.12)] px-1 py-0.5 text-[rgb(var(--accent))]">[[Meeting Notes]]</span>
            <span className="text-[rgb(var(--text-3))]"> and </span>
            <span className="rounded bg-[rgb(var(--accent)/0.12)] px-1 py-0.5 text-[rgb(var(--accent))]">[[Project Plan]]</span>
          </div>
        </ExplainerCard>

        <ExplainerCard iconName="layers" title="Transclusion — embed note content">
          <p className="mb-3 text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
            Add <Code>!</Code> before the brackets to embed another note's content live inside this one.
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
        </ExplainerCard>

        <ExplainerCard iconName="network" title="Graph — your knowledge map">
          <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
            Every note is a node; links, shared tags and semantic similarity become edges.
            The more you write, the richer the map.
          </p>
        </ExplainerCard>
      </div>

      {paletteKey && (
        <p className="mb-5 text-center text-[11px] text-[rgb(var(--text-3))]">
          Jump to anything with <KbdKey>{displayKey(paletteKey)}</KbdKey> — notes, entries, tasks and settings.
        </p>
      )}

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}
