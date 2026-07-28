import { FeatureCard, StepHeading, StepNav } from './OnboardingAtoms'
import { Icon } from '../../../icons/Icon'

interface FeaturesStepProps {
  headingId: string
  onBack: () => void
  onNext: () => void
}

export function OnboardingFeaturesStep({ headingId, onBack, onNext }: FeaturesStepProps) {
  return (
    <div className="px-5 pb-8 pt-8 sm:px-8">
      <StepHeading
        id={headingId}
        title="Everything in one place"
        subtitle="Works completely offline. No internet required."
      />

      <div className="mb-4 grid grid-cols-2 gap-2">
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
          desc="Boards with sprints, swimlanes, list and backlog views."
        />
        <FeatureCard
          iconName="pen-line"
          title="Pen notes"
          desc="Handwrite with a stylus. Low-latency inking, tuned for tablets."
        />
        <FeatureCard
          iconName="pen-tool"
          title="Canvas"
          desc="Arrange notes, text, and web pages on an infinite visual board."
        />
        <FeatureCard
          iconName="paperclip"
          title="Attachments"
          desc="Drop in images, PDFs and files — organised in their own folders."
        />
      </div>

      <div className="mb-5 flex flex-col gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3.5">
        <div className="flex items-start gap-2">
          <Icon name="trash-2" size={12} className="mt-0.5 shrink-0 text-[rgb(var(--text-3))]" />
          <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
            <span className="font-semibold text-[rgb(var(--text-2))]">Nothing is lost by accident.</span>{' '}
            Deleting anything moves it to the Trash, where you can restore it until the retention timer clears it.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Icon name="shield-check" size={12} className="mt-0.5 shrink-0 text-[rgb(var(--text-3))]" />
          <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
            <span className="font-semibold text-[rgb(var(--text-2))]">No accounts, no telemetry.</span>{' '}
            Your data never leaves your device unless you set up sync yourself.
          </p>
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}
