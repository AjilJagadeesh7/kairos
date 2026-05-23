import { SectionCard } from '../../molecules/SectionCard'
import { Icon } from '../../../icons/Icon'
import { AppLogo } from '../../atoms/AppLogo'
import type { IconToken } from '../../../icons/tokens'

const FEATURES: Array<{ iconName: IconToken; title: string; desc: string }> = [
  {
    iconName: 'sticky-note',
    title: 'Notes',
    desc: 'Markdown editor with wikilinks ([[title]]), transclusion (![[title]]), tags, backlinks, full-text & semantic search, version history, PDF export, and 11 note templates.',
  },
  {
    iconName: 'calendar-days',
    title: 'Journal',
    desc: 'Daily entries with a calendar sidebar, full-text search across all entries, version history per entry, and auto-save.',
  },
  {
    iconName: 'square-kanban',
    title: 'Kanban',
    desc: 'Multi-board task management with drag-and-drop columns, subtasks, checkpoints, priorities, due dates, and labels.',
  },
  {
    iconName: 'network',
    title: 'Knowledge Graph',
    desc: 'Force-directed 3D graph of note connections via wikilinks. Tag clusters, neighbourhood focus, and right-click link creation.',
  },
  {
    iconName: 'history',
    title: 'Version History',
    desc: 'Every save creates a snapshot. Browse previous versions of any note or journal entry and restore with one click.',
  },
  {
    iconName: 'folder-sync',
    title: 'Sync',
    desc: 'Optional S3-compatible and WebDAV sync. Notes are encrypted on-device before upload — the server never sees plaintext.',
  },
  {
    iconName: 'brain-circuit',
    title: 'Local AI',
    desc: 'Semantic search and embeddings via a local Ollama endpoint. No data leaves your device to any cloud AI service.',
  },
]

const PRIVACY_POINTS = [
  'No accounts, no sign-up, no email required.',
  'All notes are stored locally on your device only.',
  'No telemetry, analytics, or usage tracking of any kind.',
  'Sync is completely optional. When enabled, notes are encrypted with your key before leaving your device.',
  'The sync server (S3/WebDAV) stores only ciphertext — it cannot read your notes.',
  'AI features use a local model endpoint you configure; no data is sent to any cloud AI service.',
  'The app works fully offline; no network connection is ever required.',
]

export function AboutSection() {
  return (
    <div className="space-y-5">
      {/* About */}
      <SectionCard title="About MindVault">
        <div className="mb-4 flex items-center gap-3">
          <AppLogo size={48} />
          <div>
            <p className="font-bold text-text">MindVault</p>
            <p className="text-xs text-text3">Privacy-first, local-first knowledge base</p>
          </div>
        </div>
        <div className="space-y-3 text-sm text-[rgb(var(--text-2))]">
          <p>
            MindVault is a <strong className="text-[rgb(var(--text))]">privacy-first, local-first knowledge base</strong> combining
            a rich markdown note editor, daily journal, kanban boards, and a visual knowledge graph — all without requiring an
            account or sending any data to external servers.
          </p>
          <p>
            Everything lives on your device. Sync is optional and always encrypted end-to-end before leaving your machine.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="rounded-full bg-[rgb(var(--surface-2))] px-2.5 py-1 font-mono text-xs text-[rgb(var(--text-3))]">
              v0.1.0
            </span>
            <span className="rounded-full bg-[rgb(var(--surface-2))] px-2.5 py-1 font-mono text-xs text-[rgb(var(--text-3))]">
              AGPL-3.0
            </span>
            <a
              href="https://github.com/AjilJagadeesh7/mindvault"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--surface-2))] px-2.5 py-1 font-mono text-xs text-[rgb(var(--accent))] transition hover:underline"
            >
              <Icon name="git-fork" size={11} /> GitHub <Icon name="external-link" size={10} />
            </a>
          </div>
        </div>
      </SectionCard>

      {/* Author */}
      <SectionCard title="Author">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.1)] text-lg font-bold text-[rgb(var(--accent))]">
            AJ
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[rgb(var(--text))]">Ajil Jagadeesh</p>
            <p className="mt-0.5 text-xs text-[rgb(var(--text-3))]">Designer & developer of MindVault</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href="https://github.com/AjilJagadeesh7"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1 text-xs text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))]"
              >
                <Icon name="git-fork" size={11} /> @AjilJagadeesh7
              </a>
              <a
                href="mailto:ajiljagadeesh7@gmail.com"
                className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1 text-xs text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))]"
              >
                ajiljagadeesh7@gmail.com
              </a>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Features */}
      <SectionCard title="Features">
        <ul className="space-y-3">
          {FEATURES.map(({ iconName, title, desc }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]">
                <Icon name={iconName} size={14} />
              </span>
              <div>
                <p className="text-sm font-medium text-[rgb(var(--text))]">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--text-3))]">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Privacy Notice */}
      <SectionCard title="Privacy Notice">
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-[rgb(var(--accent))]/20 bg-[rgb(var(--accent))]/5 px-3 py-2.5">
            <Icon name="shield-check" size={15} className="mt-0.5 shrink-0 text-[rgb(var(--accent))]" />
            <p className="text-xs leading-relaxed text-[rgb(var(--text-2))]">
              MindVault is designed to keep your data yours. Here is exactly what we do and do not do.
            </p>
          </div>
          <ul className="space-y-2">
            {PRIVACY_POINTS.map(point => (
              <li key={point} className="flex items-start gap-2 text-xs leading-relaxed text-[rgb(var(--text-2))]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--accent))]" />
                {point}
              </li>
            ))}
          </ul>
          <p className="pt-1 text-[11px] text-[rgb(var(--text-3))]">
            MindVault is open-source software released under the GNU Affero General Public License v3.0. You can read,
            audit, and modify the source code. Any modified version distributed over a network must also be made available
            under AGPL-3.0.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}
